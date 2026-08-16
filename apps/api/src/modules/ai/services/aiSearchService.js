/**
 * AiSearchService (Stage 15.2) — "cheap hotels with a pool in Yerevan" ->
 * real marketplace filters: a keyword phrase, a category id, and amenity
 * ids, all resolved against real data the same way `TripPlannerService`
 * resolves a destination and interests. The AI call only restates the
 * query as a short keyword phrase (`prompts/search.js`); it is never
 * trusted to invent a category, amenity, or city id itself — those are
 * matched deterministically here against `searchService.searchCategories()`
 * and `searchService.getFilterDefinitions()`, the exact same catalog
 * `GET /search/filters` already serves to `DynamicFilterPanel`.
 */

import {
  AuthenticationError,
  ValidationError,
} from '../../../errors/AppError.js';
import { buildAiSearchPrompt } from '../prompts/search.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const AMENITY_VALUE_SOURCE = 'AMENITY';

export class AiSearchService {
  #searchService;

  #aiService;

  constructor({ searchService, aiService }) {
    this.#searchService = searchService;
    this.#aiService = aiService;
  }

  /** Free-text query matched against real, existing category names — never invented (mirrors `TripPlannerService`'s interest matching). */
  async #resolveCategory(query) {
    const categories = await this.#searchService.searchCategories();
    const lowerQuery = query.toLowerCase();
    return (
      categories.find((category) =>
        lowerQuery.includes(String(category.name).toLowerCase()),
      ) ?? null
    );
  }

  /** Matches the query against the resolved category's real amenity options (`GET /search/filters`'s own catalog) — an unmatched category yields no amenities rather than a guess. */
  async #resolveAmenityIds(query, categoryId) {
    if (!categoryId) return [];
    const filterGroups =
      await this.#searchService.getFilterDefinitions(categoryId);
    const lowerQuery = query.toLowerCase();
    const amenityIds = new Set();
    filterGroups.forEach((group) => {
      (group.definitions ?? []).forEach((definition) => {
        if (definition.valueSource !== AMENITY_VALUE_SOURCE) return;
        (definition.options ?? []).forEach((option) => {
          if (lowerQuery.includes(String(option.code).toLowerCase())) {
            amenityIds.add(option.value);
          }
        });
      });
    });
    return Array.from(amenityIds);
  }

  // eslint-disable-next-line class-methods-use-this -- kept as an instance method for consistency with the rest of the class
  #extractKeyword(content, fallback) {
    try {
      const parsed = JSON.parse(content);
      if (
        parsed &&
        typeof parsed.originalQuery === 'string' &&
        parsed.originalQuery.trim()
      ) {
        return parsed.originalQuery.trim();
      }
    } catch {
      // A real provider's free-text restatement isn't JSON — its content
      // itself IS the keyword phrase the prompt asked for.
      if (content && content.trim()) return content.trim();
    }
    return fallback;
  }

  async parseQuery(principal, { query }) {
    if (!principal) throw new AuthenticationError();
    const trimmed = (query ?? '').trim();
    if (!trimmed) {
      throw new ValidationError('Search query is required.', [
        { field: 'query', issue: 'REQUIRED' },
      ]);
    }

    const category = await this.#resolveCategory(trimmed);
    const amenityIds = await this.#resolveAmenityIds(
      trimmed,
      category?.id ?? null,
    );

    const { system, user } = buildAiSearchPrompt({ query: trimmed });
    const { content, providerCode, cacheHit } = await this.#aiService.complete({
      principal,
      featureCode: FEATURE_CODES.SEARCH_PARSE,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const keyword = this.#extractKeyword(content, trimmed);

    return {
      keyword,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      amenityIds,
      providerCode,
      cacheHit,
    };
  }
}

export default AiSearchService;
