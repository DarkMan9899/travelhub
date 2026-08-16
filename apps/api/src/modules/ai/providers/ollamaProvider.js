/**
 * OllamaProvider — real `AIProvider` adapter against a local/self-hosted
 * Ollama server. Selected via `AI_DEFAULT_PROVIDER=ollama`
 * (`OLLAMA_BASE_URL` defaults to `http://localhost:11434`) — no API key
 * required, since Ollama serves a local/private model. Ollama's stream
 * format is newline-delimited JSON, not SSE, unlike every other real
 * adapter in this directory — see `httpStreamUtils.js`'s `iterateNdjsonLines`.
 */

import { AIProvider } from './AIProvider.js';
import { iterateNdjsonLines } from './httpStreamUtils.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:provider:ollama');

export class OllamaProvider extends AIProvider {
  #baseUrl;

  #model;

  #fetchImpl;

  constructor({ baseUrl, model, fetchImpl = fetch } = {}) {
    super();
    this.#baseUrl = baseUrl;
    this.#model = model;
    this.#fetchImpl = fetchImpl;
  }

  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'ollama';
  }

  #assertConfigured() {
    if (!this.#baseUrl) {
      throw new ExternalServiceError(
        'The Ollama provider is selected but OLLAMA_BASE_URL is not configured.',
      );
    }
  }

  #url() {
    return `${this.#baseUrl.replace(/\/$/, '')}/api/chat`;
  }

  #buildBody({ messages, temperature, stream }) {
    return JSON.stringify({
      model: this.#model,
      messages,
      stream,
      options: { temperature: temperature ?? 0.7 },
    });
  }

  async complete(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(this.#url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.#buildBody({ ...request, stream: false }),
      });
    } catch (err) {
      log.error({ err }, 'Ollama request failed');
      throw new ExternalServiceError('Failed to reach the Ollama server.');
    }
    if (!response.ok) {
      log.error({ status: response.status }, 'Ollama returned a non-OK status');
      throw new ExternalServiceError('The Ollama server returned an error.');
    }
    const payload = await response.json();
    return {
      content: payload.message?.content ?? '',
      model: payload.model ?? this.#model,
      usage: {
        promptTokens: payload.prompt_eval_count ?? 0,
        completionTokens: payload.eval_count ?? 0,
      },
    };
  }

  async *stream(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(this.#url(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: this.#buildBody({ ...request, stream: true }),
      });
    } catch (err) {
      log.error({ err }, 'Ollama stream request failed');
      throw new ExternalServiceError('Failed to reach the Ollama server.');
    }
    if (!response.ok || !response.body) {
      log.error(
        { status: response.status },
        'Ollama stream returned a non-OK status',
      );
      throw new ExternalServiceError('The Ollama server returned an error.');
    }

    for await (const line of iterateNdjsonLines(response.body)) {
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue; // eslint-disable-line no-continue -- malformed line, skip rather than abort the stream
      }
      const delta = parsed.message?.content;
      if (delta) {
        yield { delta, done: false };
      }
      if (parsed.done) {
        yield {
          delta: '',
          done: true,
          model: parsed.model ?? this.#model,
          usage: {
            promptTokens: parsed.prompt_eval_count ?? 0,
            completionTokens: parsed.eval_count ?? 0,
          },
        };
        return;
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

export default OllamaProvider;
