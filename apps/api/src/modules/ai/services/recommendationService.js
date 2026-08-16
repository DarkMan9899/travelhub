/**
 * RecommendationService (Stage 15.4, extended in the Phase 15 "AI Polish"
 * sprint) — personalized recommendations built entirely from real signals,
 * never a cold-start guess presented as personalized. The candidate
 * listings come from `ai_user_memory`'s real category/destination affinity
 * counters — passively built by `events/aiListener.js` from the user's own
 * past `BOOKING_COMPLETED`/`REVIEW_SUBMITTED`/`FAVORITE_ADDED` events —
 * resolved against `searchService.searchListings`, the same public read
 * path `TripPlannerService` and classic search both use. A user with no
 * such history yet gets an honest empty result, never a fabricated
 * "popular" fallback.
 *
 * The "AI Polish" sprint widened this beyond a single top-1 category/city:
 * a second-ranked affinity now backfills the page when the primary
 * affinity's search doesn't fill it (still 100% real signals, just more of
 * them), and a `typicalBudget` signal — the average `totalAmount` of the
 * user's own real `COMPLETED` bookings, via the already-injected
 * `bookingService` — is used to re-rank the final list toward listings
 * priced close to what this user actually tends to spend. No search-history
 * log or "travel style"/"preferences" fields exist anywhere in this schema
 * today, so those two signals the brief mentioned are deliberately not
 * simulated here — an honest omission, not a silent gap.
 */

import { AuthenticationError } from '../../../errors/AppError.js';
import { buildRecommendationsPrompt } from '../prompts/recommendations.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const CATEGORY_AFFINITY_PREFIX = 'category_affinity:';
const DESTINATION_AFFINITY_PREFIX = 'destination_affinity:';
const MAX_RANKED_AFFINITIES = 2;
const COMPLETED_BOOKINGS_SAMPLE_SIZE = 10;

/** Every affinity counter matching `prefix`, ranked by real event count — not just the single top-1. */
function rankAffinities(memoryEntries, prefix, limit = MAX_RANKED_AFFINITIES) {
  return memoryEntries
    .filter((entry) => entry.key.startsWith(prefix))
    .map((entry) => ({
      id: Number(entry.key.slice(prefix.length)),
      label: entry.value?.label ?? entry.key.slice(prefix.length),
      count: entry.value?.count ?? 0,
    }))
    .filter((entry) => Number.isInteger(entry.id) && entry.id > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export class RecommendationService {
  #aiMemoryService;

  #searchService;

  #aiService;

  #bookingService;

  constructor({ aiMemoryService, searchService, aiService, bookingService }) {
    this.#aiMemoryService = aiMemoryService;
    this.#searchService = searchService;
    this.#aiService = aiService;
    this.#bookingService = bookingService;
  }

  async #searchByAffinity(category, city, limit) {
    if (!category && !city) return [];
    const { rows } = await this.#searchService.searchListings(null, {
      categoryId: category?.id,
      cityId: city?.id,
      limit,
      sort: 'newest',
    });
    return rows;
  }

  /** Real signal: the average `totalAmount` of this user's own completed bookings — never a fabricated "typical" figure. */
  async #resolveTypicalBudget(principal) {
    if (!this.#bookingService) return null;
    const { rows } = await this.#bookingService.listBookings(
      principal,
      { status: 'COMPLETED' },
      { limit: COMPLETED_BOOKINGS_SAMPLE_SIZE },
    );
    const amounts = (rows ?? [])
      .map((row) => Number(row.totalAmount))
      .filter((amount) => Number.isFinite(amount) && amount > 0);
    if (amounts.length === 0) return null;
    const average =
      amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
    return {
      amount: Math.round(average),
      currency: rows[0]?.currencyCode ?? null,
    };
  }

  async getRecommendations(principal, { limit = 8 } = {}) {
    if (!principal) throw new AuthenticationError();

    const memory = await this.#aiMemoryService.getMemoryForUser(principal);
    const rankedCategories = rankAffinities(memory, CATEGORY_AFFINITY_PREFIX);
    const rankedCities = rankAffinities(memory, DESTINATION_AFFINITY_PREFIX);
    const topCategory = rankedCategories[0] ?? null;
    const topCity = rankedCities[0] ?? null;

    if (!topCategory && !topCity) {
      return { listings: [], blurb: null, basedOn: null };
    }

    const [primaryListings, typicalBudget] = await Promise.all([
      this.#searchByAffinity(topCategory, topCity, limit),
      this.#resolveTypicalBudget(principal),
    ]);

    let listings = primaryListings;
    const secondaryCategory = rankedCategories[1] ?? null;
    const secondaryCity = rankedCities[1] ?? null;
    if (listings.length < limit && (secondaryCategory || secondaryCity)) {
      const secondaryListings = await this.#searchByAffinity(
        secondaryCategory ?? topCategory,
        secondaryCity ?? topCity,
        limit - listings.length,
      );
      const seenIds = new Set(listings.map((row) => row.id));
      listings = [
        ...listings,
        ...secondaryListings.filter((row) => !seenIds.has(row.id)),
      ];
    }

    if (typicalBudget) {
      listings = [...listings].sort(
        (a, b) =>
          Math.abs((a.priceAmount ?? 0) - typicalBudget.amount) -
          Math.abs((b.priceAmount ?? 0) - typicalBudget.amount),
      );
    }

    const basedOn = {
      category: topCategory?.label ?? null,
      city: topCity?.label ?? null,
      typicalBudget,
    };
    const { system, user } = buildRecommendationsPrompt(basedOn);
    const { content: blurb } = await this.#aiService.complete({
      principal,
      featureCode: FEATURE_CODES.RECOMMENDATIONS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    return { listings, blurb, basedOn };
  }
}

export default RecommendationService;
