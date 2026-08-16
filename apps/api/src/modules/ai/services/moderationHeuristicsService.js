/**
 * ModerationHeuristicsService (Stage 15.6) — real, key-independent
 * duplicate-listing and spam-signal detection. The heuristic score
 * always stands alone (works with zero AI provider configuration); an
 * optional AI-enhanced classification pass runs through the normal
 * `aiService.complete()` gateway afterward, honestly labeled as
 * unavailable by the local default provider when no real key is
 * configured (`localHeuristicProvider.js`'s `composeModeration`).
 *
 * Duplicate/spam detection reuses `listingService.listListingsAdmin`/
 * `getListingAdminDetail` (Stage 11.3's existing admin read paths) —
 * never a second Repository over `listings`' table.
 */

import { buildModerationPrompt } from '../prompts/moderation.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const DUPLICATE_TITLE_SIMILARITY_THRESHOLD = 0.7;
const ALL_CAPS_MIN_LENGTH = 8;

function tokenize(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length > 1),
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function isAllCaps(text) {
  const letters = String(text ?? '').replace(/[^\p{L}]/gu, '');
  return (
    letters.length >= ALL_CAPS_MIN_LENGTH && letters === letters.toUpperCase()
  );
}

function hasExcessivePunctuation(text) {
  return /[!?$]{3,}/.test(String(text ?? ''));
}

function collectSpamSignals(title, description = '') {
  const signals = [];
  if (isAllCaps(title)) signals.push('TITLE_ALL_CAPS');
  if (hasExcessivePunctuation(title) || hasExcessivePunctuation(description)) {
    signals.push('EXCESSIVE_PUNCTUATION');
  }
  if (description && description.trim().length < 20) {
    signals.push('DESCRIPTION_TOO_SHORT');
  }
  return signals;
}

export class ModerationHeuristicsService {
  #listingService;

  #aiService;

  constructor({ listingService, aiService }) {
    this.#listingService = listingService;
    this.#aiService = aiService;
  }

  /**
   * Real-time, on-demand scan over the most recently created listings
   * (title-only signals — cheap in bulk via the existing admin summary
   * read). A richer per-listing score (including description) is
   * available via `scoreListing`.
   */
  async getModerationQueue(principal, { limit = 50 } = {}) {
    const page = await this.#listingService.listListingsAdmin(
      principal,
      {},
      { limit },
    );
    const listings = page.rows ?? page.results ?? [];

    const byPartner = new Map();
    listings.forEach((listing) => {
      if (!byPartner.has(listing.partnerId))
        byPartner.set(listing.partnerId, []);
      byPartner.get(listing.partnerId).push(listing);
    });

    return listings
      .map((listing) => {
        const siblings = byPartner
          .get(listing.partnerId)
          .filter((other) => other.id !== listing.id);
        const titleTokens = tokenize(listing.title);
        const maxDuplicateSimilarity = siblings.reduce((max, sibling) => {
          const similarity = jaccardSimilarity(
            titleTokens,
            tokenize(sibling.title),
          );
          return Math.max(max, similarity);
        }, 0);

        const signals = collectSpamSignals(listing.title);
        if (maxDuplicateSimilarity >= DUPLICATE_TITLE_SIMILARITY_THRESHOLD) {
          signals.push('POSSIBLE_DUPLICATE_TITLE');
        }

        const score = Math.round(
          maxDuplicateSimilarity * 60 + signals.length * 15,
        );

        return {
          listingId: listing.id,
          title: listing.title,
          partnerId: listing.partnerId,
          partnerDisplayName: listing.partnerDisplayName,
          score,
          signals,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  /** Full per-listing score, including description-based signals only available on the single-listing detail read. */
  async scoreListing(principal, listingId) {
    const listing = await this.#listingService.getListingAdminDetail(
      principal,
      listingId,
    );
    const title = listing.translations?.[0]?.title ?? '';
    const description = listing.translations?.[0]?.description ?? '';

    const siblingsPage = await this.#listingService.listListingsAdmin(
      principal,
      {},
      { limit: 50 },
    );
    const siblings = (siblingsPage.rows ?? siblingsPage.results ?? []).filter(
      (other) =>
        other.partnerId === listing.partnerId && other.id !== listing.id,
    );
    const titleTokens = tokenize(title);
    const maxDuplicateSimilarity = siblings.reduce((max, sibling) => {
      const similarity = jaccardSimilarity(
        titleTokens,
        tokenize(sibling.title),
      );
      return Math.max(max, similarity);
    }, 0);

    const signals = collectSpamSignals(title, description);
    if (maxDuplicateSimilarity >= DUPLICATE_TITLE_SIMILARITY_THRESHOLD) {
      signals.push('POSSIBLE_DUPLICATE_TITLE');
    }

    const heuristicScore = Math.min(
      100,
      Math.round(maxDuplicateSimilarity * 60 + signals.length * 15),
    );

    const { system, user } = buildModerationPrompt({
      heuristicScore,
      signals,
    });
    const { content: aiNote } = await this.#aiService.complete({
      principal,
      featureCode: FEATURE_CODES.MODERATION,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    return { listingId, heuristicScore, signals, aiNote };
  }
}

export default ModerationHeuristicsService;
