/**
 * Trip Planner prompt module (Stage 15.1). Pure function — no hardcoded
 * prompt text lives in `tripPlannerService.js`, a controller, or a React
 * component; this is the one place it's composed.
 *
 * The itinerary's *facts* (which listings, per-day cost) are already
 * computed deterministically in `tripPlannerService.js` before this
 * prompt is ever built — the AI call is only asked to write a short,
 * friendly narrative wrapping those already-real facts, never to invent
 * or recompute them (see `promptGrounding.js`'s `GROUNDING_CLAUSE`).
 */

import { buildSystemPrompt, buildUserPrompt } from './promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const ROLE_INSTRUCTIONS =
  'You are a friendly travel-planning assistant for an Armenia travel marketplace. ' +
  'Write a short (3-6 sentence) narrative introducing the trip described in the ' +
  'context below. Mention the destination, the number of days, and reference at ' +
  'least one real listing from the daily plan by name. Do not invent listings, ' +
  'prices, or availability beyond what is supplied.';

export function buildTripPlannerPrompt({
  destination,
  days,
  budget,
  currency,
  interests,
  dailyPlan,
}) {
  return {
    system: buildSystemPrompt(FEATURE_CODES.TRIP_PLANNER, ROLE_INSTRUCTIONS),
    user: buildUserPrompt('Write the trip narrative.', {
      destination,
      days,
      budget,
      currency,
      interests,
      dailyPlan,
    }),
  };
}

export default buildTripPlannerPrompt;
