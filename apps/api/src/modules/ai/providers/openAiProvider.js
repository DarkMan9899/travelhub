/**
 * OpenAiProvider — real `AIProvider` adapter against OpenAI's Chat
 * Completions API. Selected via `AI_DEFAULT_PROVIDER=openai` +
 * `OPENAI_API_KEY` (see config/index.js). Only unit-tested with mocked
 * `fetch` responses in this environment (no live key available) — see
 * `providers/providerRegistry.js` for the fail-fast behavior when
 * selected without a key.
 */

import { AIProvider } from './AIProvider.js';
import { iterateSseFrames } from './httpStreamUtils.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:provider:openai');
const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAiProvider extends AIProvider {
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
    return 'openai';
  }

  #assertConfigured() {
    if (!this.#apiKey) {
      throw new ExternalServiceError(
        'The OpenAI provider is selected but OPENAI_API_KEY is not configured.',
      );
    }
  }

  #buildBody({ messages, temperature, maxTokens, stream }) {
    return JSON.stringify({
      model: this.#model,
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 1024,
      stream,
    });
  }

  #headers() {
    return {
      Authorization: `Bearer ${this.#apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async complete(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: this.#headers(),
        body: this.#buildBody({ ...request, stream: false }),
      });
    } catch (err) {
      log.error({ err }, 'OpenAI request failed');
      throw new ExternalServiceError('Failed to reach the OpenAI API.');
    }
    if (!response.ok) {
      log.error({ status: response.status }, 'OpenAI returned a non-OK status');
      throw new ExternalServiceError('The OpenAI API returned an error.');
    }
    const payload = await response.json();
    return {
      content: payload.choices?.[0]?.message?.content ?? '',
      model: payload.model ?? this.#model,
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
      },
    };
  }

  async *stream(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(CHAT_COMPLETIONS_URL, {
        method: 'POST',
        headers: this.#headers(),
        body: this.#buildBody({ ...request, stream: true }),
      });
    } catch (err) {
      log.error({ err }, 'OpenAI stream request failed');
      throw new ExternalServiceError('Failed to reach the OpenAI API.');
    }
    if (!response.ok || !response.body) {
      log.error(
        { status: response.status },
        'OpenAI stream returned a non-OK status',
      );
      throw new ExternalServiceError('The OpenAI API returned an error.');
    }

    let model = this.#model;
    for await (const frame of iterateSseFrames(response.body)) {
      if (frame === '[DONE]') break;
      let parsed;
      try {
        parsed = JSON.parse(frame);
      } catch {
        continue; // eslint-disable-line no-continue -- malformed frame, skip rather than abort the stream
      }
      model = parsed.model ?? model;
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        yield { delta, done: false };
      }
    }
    yield {
      delta: '',
      done: true,
      model,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

export default OpenAiProvider;
