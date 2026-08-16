/**
 * GeminiProvider — real `AIProvider` adapter against Google's Generative
 * Language API. Selected via `AI_DEFAULT_PROVIDER=gemini` +
 * `GEMINI_API_KEY`. Gemini's wire format uses `contents`/`parts` rather
 * than a flat `messages` array and a separate `systemInstruction` block —
 * translated here, once, so nothing above this adapter needs to know.
 */

import { AIProvider } from './AIProvider.js';
import { iterateSseFrames } from './httpStreamUtils.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:provider:gemini');
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function splitSystemAndContents(messages) {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return {
    systemInstruction: systemMessages.length
      ? { parts: [{ text: systemMessages.map((m) => m.content).join('\n\n') }] }
      : undefined,
    contents,
  };
}

export class GeminiProvider extends AIProvider {
  #apiKey;

  #model;

  #fetchImpl;

  constructor({ apiKey, model, fetchImpl = fetch } = {}) {
    super();
    this.#apiKey = apiKey;
    this.#model = model;
    this.#fetchImpl = fetchImpl;
  }

  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'gemini';
  }

  #assertConfigured() {
    if (!this.#apiKey) {
      throw new ExternalServiceError(
        'The Gemini provider is selected but GEMINI_API_KEY is not configured.',
      );
    }
  }

  #buildBody({ messages, temperature, maxTokens }) {
    const { systemInstruction, contents } = splitSystemAndContents(messages);
    return JSON.stringify({
      contents,
      systemInstruction,
      generationConfig: {
        temperature: temperature ?? 0.7,
        maxOutputTokens: maxTokens ?? 1024,
      },
    });
  }

  async complete(request) {
    this.#assertConfigured();
    const url = `${BASE_URL}/${this.#model}:generateContent?key=${this.#apiKey}`;
    let response;
    try {
      response = await this.#fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.#buildBody(request),
      });
    } catch (err) {
      log.error({ err }, 'Gemini request failed');
      throw new ExternalServiceError('Failed to reach the Gemini API.');
    }
    if (!response.ok) {
      log.error({ status: response.status }, 'Gemini returned a non-OK status');
      throw new ExternalServiceError('The Gemini API returned an error.');
    }
    const payload = await response.json();
    const content = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    return {
      content,
      model: this.#model,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }

  async *stream(request) {
    this.#assertConfigured();
    const url = `${BASE_URL}/${this.#model}:streamGenerateContent?alt=sse&key=${this.#apiKey}`;
    let response;
    try {
      response = await this.#fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.#buildBody(request),
      });
    } catch (err) {
      log.error({ err }, 'Gemini stream request failed');
      throw new ExternalServiceError('Failed to reach the Gemini API.');
    }
    if (!response.ok || !response.body) {
      log.error(
        { status: response.status },
        'Gemini stream returned a non-OK status',
      );
      throw new ExternalServiceError('The Gemini API returned an error.');
    }

    for await (const frame of iterateSseFrames(response.body)) {
      let parsed;
      try {
        parsed = JSON.parse(frame);
      } catch {
        continue; // eslint-disable-line no-continue -- malformed frame, skip rather than abort the stream
      }
      const delta = (parsed.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? '')
        .join('');
      if (delta) {
        yield { delta, done: false };
      }
    }
    yield {
      delta: '',
      done: true,
      model: this.#model,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

export default GeminiProvider;
