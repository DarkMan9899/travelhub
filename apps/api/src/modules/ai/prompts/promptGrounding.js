/**
 * Shared prompt-composition helpers (Phase 15).
 *
 * Every prompt module in this directory (`tripPlanner.js`, `search.js`,
 * `travelAssistant.js`, ...) builds its `{system, user}` pair through
 * these two functions rather than hand-writing prompt strings — this is
 * where the platform's one anti-hallucination rule lives, once, instead
 * of being copy-pasted into every prompt template.
 *
 * `buildSystemPrompt` prefixes every system message with a machine-
 * readable `[[ai-feature:<code>]]` tag. This is not decorative: it's how
 * the zero-dependency `LocalHeuristicProvider` (the default provider,
 * used whenever no real provider API key is configured) knows which
 * deterministic template to compose a response with — every other
 * (real) provider simply ignores the tag line as ordinary system-prompt
 * text. `buildUserPrompt` appends the real grounding data as a fenced
 * JSON block for the same reason: a real provider reads it as context,
 * `LocalHeuristicProvider` parses it back out to compose a grounded,
 * real answer instead of a canned string.
 */

export const GROUNDING_CLAUSE =
  'Answer using ONLY the data supplied in the "context" JSON block below. ' +
  'If the data needed to answer is not present in that block, say plainly ' +
  'that you do not have that information — never invent a listing, price, ' +
  'policy, or fact that is not in the supplied context.';

/**
 * @param {string} featureCode - one of FEATURE_CODES (ai/constants/featureCodes.js)
 * @param {string} roleInstructions - feature-specific persona/task instructions
 * @returns {string}
 */
export function buildSystemPrompt(featureCode, roleInstructions) {
  return [
    `[[ai-feature:${featureCode}]]`,
    roleInstructions,
    GROUNDING_CLAUSE,
  ].join('\n\n');
}

/**
 * @param {string} instructionText - what the user/system is asking for, in plain language
 * @param {object} context - real marketplace data already resolved by the calling Service
 * @returns {string}
 */
export function buildUserPrompt(instructionText, context = {}) {
  return [
    instructionText,
    '',
    'context:',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
  ].join('\n');
}

/**
 * Extracts the `[[ai-feature:X]]` tag `buildSystemPrompt` prefixes every
 * system message with. Used only by `LocalHeuristicProvider` — every
 * real provider adapter ignores this and forwards `messages` as-is.
 */
export function extractFeatureCode(systemContent = '') {
  const match = /^\[\[ai-feature:([a-z_]+)\]\]/.exec(systemContent.trim());
  return match ? match[1] : null;
}

/**
 * Extracts the fenced ```json context block `buildUserPrompt` appends.
 * Returns `{}` if the block is missing or fails to parse, rather than
 * throwing — a malformed/missing context block should degrade to "I
 * don't have that information", never crash the request.
 */
export function extractContext(userContent = '') {
  const match = /```json\s*([\s\S]*?)\s*```/.exec(userContent);
  if (!match) return {};
  try {
    return JSON.parse(match[1]);
  } catch {
    return {};
  }
}
