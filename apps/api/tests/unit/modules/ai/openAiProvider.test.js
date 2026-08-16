import { describe, test, expect, jest } from '@jest/globals';
import { OpenAiProvider } from '../../../../src/modules/ai/providers/openAiProvider.js';
import { ExternalServiceError } from '../../../../src/errors/AppError.js';

const MESSAGES = [{ role: 'user', content: 'hi' }];

describe('OpenAiProvider', () => {
  test('code is "openai"', () => {
    expect(new OpenAiProvider({ apiKey: 'k', model: 'gpt-4o-mini' }).code).toBe(
      'openai',
    );
  });

  test('complete() throws ExternalServiceError when no API key is configured', async () => {
    const provider = new OpenAiProvider({ apiKey: '', model: 'gpt-4o-mini' });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('complete() maps a successful OpenAI response into the AIProvider shape', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'hello there' } }],
        usage: { prompt_tokens: 10, completion_tokens: 4 },
      }),
    });
    const provider = new OpenAiProvider({
      apiKey: 'k',
      model: 'gpt-4o-mini',
      fetchImpl,
    });
    const result = await provider.complete({ messages: MESSAGES });
    expect(result).toEqual({
      content: 'hello there',
      model: 'gpt-4o-mini',
      usage: { promptTokens: 10, completionTokens: 4 },
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(options.headers.Authorization).toBe('Bearer k');
    expect(JSON.parse(options.body).messages).toEqual(MESSAGES);
  });

  test('complete() throws ExternalServiceError on a non-OK response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new OpenAiProvider({
      apiKey: 'k',
      model: 'gpt-4o-mini',
      fetchImpl,
    });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('complete() throws ExternalServiceError when the network call itself fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new OpenAiProvider({
      apiKey: 'k',
      model: 'gpt-4o-mini',
      fetchImpl,
    });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('stream() parses SSE frames into delta chunks and a final done chunk', async () => {
    const sse =
      'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"hel"}}]}\n\n' +
      'data: {"model":"gpt-4o-mini","choices":[{"delta":{"content":"lo"}}]}\n\n' +
      'data: [DONE]\n\n';
    const encoder = new TextEncoder();
    async function* body() {
      yield encoder.encode(sse);
    }
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, body: body() });
    const provider = new OpenAiProvider({
      apiKey: 'k',
      model: 'gpt-4o-mini',
      fetchImpl,
    });
    const chunks = [];
    for await (const chunk of provider.stream({ messages: MESSAGES })) {
      chunks.push(chunk);
    }
    expect(chunks.map((c) => c.delta).join('')).toBe('hello');
    expect(chunks[chunks.length - 1].done).toBe(true);
  });
});
