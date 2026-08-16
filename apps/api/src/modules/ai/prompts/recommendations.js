/**
 * AI Recommendations prompt module (Stage 15.4). Pure function — no
 * hardcoded prompt text lives in `recommendationService.js` or a React
 * component.
 *
 * The *listings themselves* are never AI-selected — `recommendationService.js`
 * resolves them deterministically from `ai_user_memory`'s real
 * category/destination affinity counters (built passively by
 * `events/aiListener.js` from real `BOOKING_COMPLETED`/`REVIEW_SUBMITTED`/
 * `FAVORITE_ADDED` events) via `searchService.searchListings`. The AI call
 * here only writes one short "why these" sentence introducing the already-
 * resolved list.
 */

import { buildSystemPrompt, buildUserPrompt } from './promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const ROLE_INSTRUCTIONS =
  'You are a recommendations assistant for an Armenia travel marketplace. ' +
  'Write one short, friendly sentence introducing a list of recommended ' +
  'listings, referencing the category, city, and/or typical budget below ' +
  'when supplied. Do not invent a listing name, price, or fact not ' +
  'supplied.';

export function buildRecommendationsPrompt({ category, city, typicalBudget }) {
  return {
    system: buildSystemPrompt(FEATURE_CODES.RECOMMENDATIONS, ROLE_INSTRUCTIONS),
    user: buildUserPrompt('Introduce these recommendations.', {
      category,
      city,
      typicalBudget: typicalBudget
        ? `${typicalBudget.amount} ${typicalBudget.currency ?? ''}`.trim()
        : undefined,
    }),
  };
}

export default buildRecommendationsPrompt;
