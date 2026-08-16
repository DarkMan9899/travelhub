/**
 * AI Assistant prompt module (Stage 15.3). Pure function — no hardcoded
 * prompt text lives in `assistantService.js` or a React component.
 *
 * The assistant is contextual: it only ever knows what
 * `assistantService.js` deterministically resolved (the current listing
 * or booking, via `listingService`/`bookingService` — the same
 * ownership-checked reads every other feature already uses) and the
 * conversation's own prior messages. It never receives free-standing
 * "current page" state from the client — a context is always a real,
 * server-resolved `{contextType, contextId}` pair, never trusted
 * client-supplied facts (see `promptGrounding.js`'s `GROUNDING_CLAUSE`).
 */

import { buildSystemPrompt, buildUserPrompt } from './promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const ROLE_INSTRUCTIONS =
  "You are desavii's travel assistant. Answer the traveler's question " +
  'using only the context supplied below (the current listing or booking, ' +
  'and the conversation history). Be concise and friendly.';

export function buildAssistantPrompt({ context, history = [] }) {
  const system = buildSystemPrompt(FEATURE_CODES.ASSISTANT, ROLE_INSTRUCTIONS);
  const messages = [
    { role: 'system', content: system },
    ...history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  ];
  const lastUserMessage = messages[messages.length - 1];
  // The context block is embedded in the *latest* user message only —
  // `LocalHeuristicProvider.composeAssistant` (Stage 15.0) reads context
  // off the last user message, and real providers see the full history
  // as ordinary chat turns either way.
  messages[messages.length - 1] = {
    ...lastUserMessage,
    content: buildUserPrompt(lastUserMessage.content, context),
  };
  return messages;
}

export default buildAssistantPrompt;
