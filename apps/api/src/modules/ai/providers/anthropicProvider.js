/**
 * AnthropicProvider — real `AIProvider` adapter against Anthropic's
 * Messages API. Selected via `AI_DEFAULT_PROVIDER=anthropic` +
 * `ANTHROPIC_API_KEY`. Anthropic's wire format separates the system
 * prompt from the `messages` array (unlike OpenAI's shape) — this
 * adapter is the one place that translation happens, so nothing above it
 * needs to know.
 */

import { AIProvider } from './AIProvider.js';
import { iterateSseFrames } from './httpStreamUtils.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:provider:anthropic');
const MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function splitSystemAndMessages(messages) {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return {
    system: systemMessages.map((m) => m.content).join('\n\n'),
    messages: rest,
  };
}

export class AnthropicProvider extends AIProvider {
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
    return 'anthropic';
  }

  #assertConfigured() {
    if (!this.#apiKey) {
      throw new ExternalServiceError(
        'The Anthropic provider is selected but ANTHROPIC_API_KEY is not configured.',
      );
    }
  }

  #headers() {
    return {
      'x-api-key': this.#apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    };
  }

  #buildBody({ messages, temperature, maxTokens, stream }) {
    const { system, messages: rest } = splitSystemAndMessages(messages);
    return JSON.stringify({
      model: this.#model,
      system,
      messages: rest,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 1024,
      stream,
    });
  }

  async complete(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(MESSAGES_URL, {
        method: 'POST',
        headers: this.#headers(),
        body: this.#buildBody({ ...request, stream: false }),
      });
    } catch (err) {
      log.error({ err }, 'Anthropic request failed');
      throw new ExternalServiceError('Failed to reach the Anthropic API.');
    }
    if (!response.ok) {
      log.error(
        { status: response.status },
        'Anthropic returned a non-OK status',
      );
      throw new ExternalServiceError('The Anthropic API returned an error.');
    }
    const payload = await response.json();
    const content = (payload.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');
    return {
      content,
      model: payload.model ?? this.#model,
      usage: {
        promptTokens: payload.usage?.input_tokens ?? 0,
        completionTokens: payload.usage?.output_tokens ?? 0,
      },
    };
  }

  async *stream(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(MESSAGES_URL, {
        method: 'POST',
        headers: this.#headers(),
        body: this.#buildBody({ ...request, stream: true }),
      });
    } catch (err) {
      log.error({ err }, 'Anthropic stream request failed');
      throw new ExternalServiceError('Failed to reach the Anthropic API.');
    }
    if (!response.ok || !response.body) {
      log.error(
        { status: response.status },
        'Anthropic stream returned a non-OK status',
      );
      throw new ExternalServiceError('The Anthropic API returned an error.');
    }

    for await (const frame of iterateSseFrames(response.body)) {
      let parsed;
      try {
        parsed = JSON.parse(frame);
      } catch {
        continue; // eslint-disable-line no-continue -- malformed frame, skip rather than abort the stream
      }
      if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
        yield { delta: parsed.delta.text, done: false };
      }
      if (parsed.type === 'message_stop') {
        yield {
          delta: '',
          done: true,
          model: this.#model,
          usage: { promptTokens: 0, completionTokens: 0 },
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

export default AnthropicProvider;
