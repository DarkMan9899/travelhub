/**
 * AzureOpenAiProvider — real `AIProvider` adapter against an Azure
 * OpenAI resource's chat-completions deployment. Selected via
 * `AI_DEFAULT_PROVIDER=azure_openai` + `AZURE_OPENAI_API_KEY`/
 * `AZURE_OPENAI_ENDPOINT`/`AZURE_OPENAI_DEPLOYMENT`. The request/response
 * JSON shape is identical to OpenAI's own Chat Completions API — only
 * the URL and auth header differ, which is why this adapter exists
 * separately from `openAiProvider.js` rather than being a config flag on
 * it (a genuinely different endpoint/auth scheme, not just a different
 * model string).
 */

import { AIProvider } from './AIProvider.js';
import { iterateSseFrames } from './httpStreamUtils.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:provider:azure_openai');

export class AzureOpenAiProvider extends AIProvider {
  #apiKey;

  #endpoint;

  #deployment;

  #apiVersion;

  #fetchImpl;

  constructor({
    apiKey,
    endpoint,
    deployment,
    apiVersion,
    fetchImpl = fetch,
  } = {}) {
    super();
    this.#apiKey = apiKey;
    this.#endpoint = endpoint;
    this.#deployment = deployment;
    this.#apiVersion = apiVersion;
    this.#fetchImpl = fetchImpl;
  }

  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'azure_openai';
  }

  #assertConfigured() {
    if (!this.#apiKey || !this.#endpoint || !this.#deployment) {
      throw new ExternalServiceError(
        'The Azure OpenAI provider is selected but AZURE_OPENAI_API_KEY/ENDPOINT/DEPLOYMENT are not fully configured.',
      );
    }
  }

  #url() {
    const base = this.#endpoint.replace(/\/$/, '');
    return `${base}/openai/deployments/${this.#deployment}/chat/completions?api-version=${this.#apiVersion}`;
  }

  #headers() {
    return {
      'api-key': this.#apiKey,
      'Content-Type': 'application/json',
    };
  }

  #buildBody({ messages, temperature, maxTokens, stream }) {
    return JSON.stringify({
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 1024,
      stream,
    });
  }

  async complete(request) {
    this.#assertConfigured();
    let response;
    try {
      response = await this.#fetchImpl(this.#url(), {
        method: 'POST',
        headers: this.#headers(),
        body: this.#buildBody({ ...request, stream: false }),
      });
    } catch (err) {
      log.error({ err }, 'Azure OpenAI request failed');
      throw new ExternalServiceError('Failed to reach the Azure OpenAI API.');
    }
    if (!response.ok) {
      log.error(
        { status: response.status },
        'Azure OpenAI returned a non-OK status',
      );
      throw new ExternalServiceError('The Azure OpenAI API returned an error.');
    }
    const payload = await response.json();
    return {
      content: payload.choices?.[0]?.message?.content ?? '',
      model: payload.model ?? this.#deployment,
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
      response = await this.#fetchImpl(this.#url(), {
        method: 'POST',
        headers: this.#headers(),
        body: this.#buildBody({ ...request, stream: true }),
      });
    } catch (err) {
      log.error({ err }, 'Azure OpenAI stream request failed');
      throw new ExternalServiceError('Failed to reach the Azure OpenAI API.');
    }
    if (!response.ok || !response.body) {
      log.error(
        { status: response.status },
        'Azure OpenAI stream returned a non-OK status',
      );
      throw new ExternalServiceError('The Azure OpenAI API returned an error.');
    }

    for await (const frame of iterateSseFrames(response.body)) {
      if (frame === '[DONE]') break;
      let parsed;
      try {
        parsed = JSON.parse(frame);
      } catch {
        continue; // eslint-disable-line no-continue -- malformed frame, skip rather than abort the stream
      }
      const delta = parsed.choices?.[0]?.delta?.content;
      if (delta) {
        yield { delta, done: false };
      }
    }
    yield {
      delta: '',
      done: true,
      model: this.#deployment,
      usage: { promptTokens: 0, completionTokens: 0 },
    };
  }
}

export default AzureOpenAiProvider;
