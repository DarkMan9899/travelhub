/**
 * Admin AI moderation prompt module (Stage 15.6). Pure function — no
 * hardcoded prompt text lives in `moderationHeuristicsService.js`.
 *
 * The heuristic score/signals are already computed deterministically
 * (real duplicate-title/spam checks, `moderationHeuristicsService.js`)
 * before this prompt is ever built — the AI call here is only an
 * optional second-pass classification note layered on top of the real
 * heuristic result, never a replacement for it.
 */

import { buildSystemPrompt, buildUserPrompt } from './promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const ROLE_INSTRUCTIONS =
  'You are a content-moderation assistant for a travel marketplace. A ' +
  'real heuristic score and signal list are supplied below. Write one ' +
  'short sentence noting whether this listing likely needs manual review, ' +
  'referencing the supplied signals only — never invent a new signal.';

export function buildModerationPrompt({ heuristicScore, signals }) {
  return {
    system: buildSystemPrompt(FEATURE_CODES.MODERATION, ROLE_INSTRUCTIONS),
    user: buildUserPrompt('Classify this listing.', {
      heuristicScore,
      signals,
    }),
  };
}

export default buildModerationPrompt;
