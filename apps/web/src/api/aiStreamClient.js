/**
 * Fetch-based SSE reader for `POST /ai/assistant/stream` (Stage 15.3).
 * Not the `EventSource` API — that can't send a POST body or an
 * `Authorization` header, and this route needs both (mirrors Messaging's
 * own "simplest correct mechanism" transport precedent). Mirrors the
 * backend's `providers/httpStreamUtils.js` frame-parsing convention,
 * client-side.
 */

import { DEFAULT_LOCALE } from '../translations/i18n.js';
import { getAccessToken } from './tokenStore.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function resolveLocale() {
  const pathLocale = window.location.pathname.split('/')[1];
  return ['hy', 'ru', 'en'].includes(pathLocale) ? pathLocale : DEFAULT_LOCALE;
}

/**
 * @param {{message: string, contextType?: string, contextId?: number, conversationId?: number}} input
 * @returns {AsyncGenerator<{delta: string, done: boolean, conversationId?: number}>}
 */
export async function* streamAssistantMessage(input) {
  const accessToken = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/ai/assistant/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': resolveLocale(),
      'X-Client': 'web',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!response.ok || !response.body) {
    throw new Error(`Assistant stream request failed (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // eslint-disable-next-line no-constant-condition -- bounded by `done` from reader.read()
  while (true) {
    // eslint-disable-next-line no-await-in-loop -- sequential stream reads by design
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    // eslint-disable-next-line no-restricted-syntax -- ordered frame parsing
    for (const frame of frames) {
      const dataLine = frame
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (dataLine) {
        yield JSON.parse(dataLine.slice('data: '.length));
      }
    }
  }
}

export default streamAssistantMessage;
