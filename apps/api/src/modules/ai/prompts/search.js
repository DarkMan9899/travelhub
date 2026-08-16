/**
 * AI Search prompt module (Stage 15.2). Pure function — no hardcoded
 * prompt text lives in `aiSearchService.js` or a React component.
 *
 * The AI call here is deliberately narrow: it is only ever asked to
 * restate the user's free-text query as a short keyword phrase suitable
 * for the marketplace's existing FULLTEXT search (`GET /search`'s
 * `keyword` param) — never to invent a category id, city id, or amenity
 * id itself. Category/amenity resolution happens deterministically in
 * `aiSearchService.js` by matching the raw query text against real
 * `searchCategories()`/`getFilterDefinitions()` data, exactly like
 * `tripPlannerService.js`'s interest-matching (see `promptGrounding.js`'s
 * `GROUNDING_CLAUSE`).
 */

import { buildSystemPrompt, buildUserPrompt } from './promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const ROLE_INSTRUCTIONS =
  'You are a search-query assistant for an Armenia travel marketplace. ' +
  'Restate the free-text query below as a short keyword phrase (a few ' +
  'words) suitable for a full-text search box — strip filler words, keep ' +
  'the traveler-meaningful terms. Do not invent a category, city, price, ' +
  'or amenity that is not implied by the query itself.';

export function buildAiSearchPrompt({ query }) {
  return {
    system: buildSystemPrompt(FEATURE_CODES.SEARCH_PARSE, ROLE_INSTRUCTIONS),
    user: buildUserPrompt('Restate this search query as a keyword phrase.', {
      query,
    }),
  };
}

export default buildAiSearchPrompt;
