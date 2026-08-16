import { describe, test, expect, jest } from '@jest/globals';
import { OllamaProvider } from '../../../../src/modules/ai/providers/ollamaProvider.js';
import { ExternalServiceError } from '../../../../src/errors/AppError.js';

const MESSAGES = [{ role: 'user', content: 'hi' }];

describe('OllamaProvider', () => {
  test('code is "ollama"', () => {
    expect(
      new OllamaProvider({
        baseUrl: 'http://localhost:11434',
        model: 'llama3.1',
      }).code,
    ).toBe('ollama');
  });

  test('complete() posts to the local server and maps a chat response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'llama3.1',
        message: { content: 'hello there' },
        prompt_eval_count: 4,
        eval_count: 2,
      }),
    });
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      fetchImpl,
    });
    const result = await provider.complete({ messages: MESSAGES });
    expect(result).toEqual({
      content: 'hello there',
      model: 'llama3.1',
      usage: { promptTokens: 4, completionTokens: 2 },
    });
    const [url] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
  });

  test('complete() throws ExternalServiceError when OLLAMA_BASE_URL is empty', async () => {
    const provider = new OllamaProvider({ baseUrl: '', model: 'llama3.1' });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('stream() parses newline-delimited JSON chunks, ending on done:true', async () => {
    const ndjson =
      '{"message":{"content":"hel"},"done":false}\n' +
      '{"message":{"content":"lo"},"done":false}\n' +
      '{"model":"llama3.1","done":true,"prompt_eval_count":4,"eval_count":2}\n';
    const encoder = new TextEncoder();
    async function* body() {
      yield encoder.encode(ndjson);
    }
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, body: body() });
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:11434',
      model: 'llama3.1',
      fetchImpl,
    });
    const chunks = [];
    for await (const chunk of provider.stream({ messages: MESSAGES })) {
      chunks.push(chunk);
    }
    expect(chunks.map((c) => c.delta).join('')).toBe('hello');
    const last = chunks[chunks.length - 1];
    expect(last.done).toBe(true);
    expect(last.usage).toEqual({ promptTokens: 4, completionTokens: 2 });
  });
});
