/**
 * TripPlannerService (Stage 15.1) — "I want a 5-day trip in Armenia,
 * budget 800 USD, nature, family" → a real, grounded itinerary.
 *
 * The itinerary's facts (which listings, per-day estimated cost) are
 * computed deterministically here from real published listings —
 * `searchService.searchListings(...)`, the same public read-path the
 * public Search page uses, never a duplicated query. `interests` are
 * matched against real category names (`searchService.searchCategories`)
 * rather than passed to the AI provider as free text to "understand" —
 * a keyword-substring match is honest about what it can and can't do,
 * and never invents a category that doesn't exist. The AI call (via
 * `aiService`) only writes the narrative wrapping these already-real
 * facts (see `prompts/tripPlanner.js`).
 */

import {
  AuthenticationError,
  ValidationError,
} from '../../../errors/AppError.js';
import { buildTripPlannerPrompt } from '../prompts/tripPlanner.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const MAX_LISTINGS_PER_SEARCH = 15;
const MAX_TOTAL_LISTINGS = 30;

function dedupeById(listings) {
  const seen = new Map();
  listings.forEach((listing) => {
    if (!seen.has(listing.id)) seen.set(listing.id, listing);
  });
  return Array.from(seen.values());
}

export class TripPlannerService {
  #searchService;

  #aiService;

  #aiConversationService;

  constructor({ searchService, aiService, aiConversationService }) {
    this.#searchService = searchService;
    this.#aiService = aiService;
    this.#aiConversationService = aiConversationService;
  }

  /** Free-text interest strings matched against real, existing category names — never invented. */
  async #resolveInterestCategoryIds(interests) {
    if (!interests || interests.length === 0) return [];
    const categories = await this.#searchService.searchCategories();
    const lowerInterests = interests.map((interest) => interest.toLowerCase());
    return categories
      .filter((category) =>
        lowerInterests.some(
          (interest) =>
            category.name.toLowerCase().includes(interest) ||
            interest.includes(category.name.toLowerCase()),
        ),
      )
      .map((category) => category.id);
  }

  async #fetchGroundingListings({ cityId, categoryIds }) {
    const batches =
      categoryIds.length > 0
        ? await Promise.all(
            categoryIds.map((categoryId) =>
              this.#searchService.searchListings(null, {
                cityId,
                categoryId,
                limit: MAX_LISTINGS_PER_SEARCH,
                sort: 'newest',
              }),
            ),
          )
        : [
            await this.#searchService.searchListings(null, {
              cityId,
              limit: MAX_TOTAL_LISTINGS,
              sort: 'newest',
            }),
          ];

    return dedupeById(batches.flatMap((batch) => batch.rows))
      .filter(
        (listing) =>
          listing.priceAmount !== null && listing.priceAmount !== undefined,
      )
      .sort((a, b) => Number(a.priceAmount) - Number(b.priceAmount))
      .slice(0, MAX_TOTAL_LISTINGS);
  }

  /** Deterministic, real allocation — round-robins listings across days while tracking running cost against budget. */
  // eslint-disable-next-line class-methods-use-this -- kept as an instance method for consistency with the rest of the class
  #buildDailyPlan(listings, days, budget) {
    const dailyPlan = Array.from({ length: days }, (_, index) => ({
      day: index + 1,
      listings: [],
      estimatedCost: 0,
    }));
    let runningTotal = 0;
    listings.forEach((listing, index) => {
      const price = Number(listing.priceAmount);
      if (runningTotal + price > budget) return;
      const day = dailyPlan[index % days];
      day.listings.push({
        id: listing.id,
        title: listing.title,
        slug: listing.slug,
        cityName: listing.cityName,
        pricePerNight: listing.priceAmount,
        currency: listing.priceCurrencyCode,
      });
      day.estimatedCost += price;
      runningTotal += price;
    });
    return dailyPlan;
  }

  async planTrip(
    principal,
    {
      destination: destinationQuery,
      days,
      budget,
      currency = 'AMD',
      interests = [],
    },
  ) {
    if (!principal) throw new AuthenticationError();
    if (!Number.isInteger(days) || days < 1 || days > 30) {
      throw new ValidationError('Trip length must be between 1 and 30 days.', [
        { field: 'days', issue: 'OUT_OF_RANGE' },
      ]);
    }

    const city = await this.#searchService.findCityByName(destinationQuery);
    if (!city) {
      throw new ValidationError(
        `We don't have any destinations matching "${destinationQuery}" yet.`,
        [{ field: 'destination', issue: 'NOT_FOUND' }],
      );
    }

    const categoryIds = await this.#resolveInterestCategoryIds(interests);
    const listings = await this.#fetchGroundingListings({
      cityId: city.id,
      categoryIds,
    });
    const dailyPlan = this.#buildDailyPlan(listings, days, budget);
    const totalEstimatedBudget = dailyPlan.reduce(
      (sum, day) => sum + day.estimatedCost,
      0,
    );
    const destination = city.name;

    const { system, user } = buildTripPlannerPrompt({
      destination,
      days,
      budget,
      currency,
      interests,
      dailyPlan,
    });
    const {
      content: narrative,
      providerCode,
      model,
      usage,
      cacheHit,
    } = await this.#aiService.complete({
      principal,
      featureCode: FEATURE_CODES.TRIP_PLANNER,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const conversation = await this.#aiConversationService.createConversation(
      principal,
      {
        featureCode: FEATURE_CODES.TRIP_PLANNER,
        title: destination
          ? `${days}-day trip to ${destination}`
          : `${days}-day trip`,
      },
    );
    await this.#aiConversationService.appendMessage(conversation.id, {
      role: 'user',
      content: user,
    });
    await this.#aiConversationService.appendMessage(conversation.id, {
      role: 'assistant',
      content: narrative,
      providerCode,
      model,
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      cacheHit,
    });

    return {
      conversationId: conversation.id,
      destination,
      days,
      budget,
      currency,
      interests,
      dailyPlan,
      totalEstimatedBudget,
      narrative,
    };
  }

  async getTrip(principal, conversationId) {
    return this.#aiConversationService.getConversationWithMessages(
      principal,
      conversationId,
    );
  }
}

export default TripPlannerService;
