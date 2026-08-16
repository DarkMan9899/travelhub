/**
 * AIProvider port (Phase 15).
 *
 * The whole point of this interface: `AiService` (and therefore every
 * feature service built on it) never knows or cares which concrete LLM
 * provider is behind it. Every adapter in this directory (Local/OpenAI/
 * Anthropic/Gemini/AzureOpenAI/Ollama) implements this exact shape and is
 * selected by `providerRegistry.js` from `config.ai.defaultProvider` —
 * swapping providers is a one-line config change, never a code change in
 * a business service, controller, or React component.
 *
 * `messages` is always the provider-agnostic shape
 * `[{role: 'system'|'user'|'assistant', content: string}]` — each adapter
 * is responsible for translating it into its own wire format.
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class AIProvider {
  /** @returns {string} a short, stable code identifying this provider (e.g. 'local', 'openai'). */
  get code() {
    throw new Error(
      'AIProvider.code must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {{messages: Array<{role: string, content: string}>, temperature?: number, maxTokens?: number}} request
   * @returns {Promise<{content: string, model: string, usage: {promptTokens: number, completionTokens: number}}>}
   */
  async complete(request) {
    throw new Error(
      'AIProvider.complete must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {{messages: Array<{role: string, content: string}>, temperature?: number, maxTokens?: number}} request
   * @returns {AsyncIterable<{delta: string, done: boolean, model?: string, usage?: {promptTokens: number, completionTokens: number}}>}
   */
  // eslint-disable-next-line require-yield -- abstract method always throws before yielding
  async *stream(request) {
    throw new Error(
      'AIProvider.stream must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default AIProvider;
