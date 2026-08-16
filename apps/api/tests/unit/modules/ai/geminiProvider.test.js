import { describe, test, expect, jest } from '@jest/globals';
import { GeminiProvider } from '../../../../src/modules/ai/providers/geminiProvider.js';
import { ExternalServiceError } from '../../../../src/errors/AppError.js';

const MESSAGES = [
  { role: 'system', content: 'Be helpful.' },
  { role: 'user', content: 'hi' },
];

describe('GeminiProvider', () => {
  test('code is "gemini"', () => {
    expect(
      new GeminiProvider({ apiKey: 'k', model: 'gemini-2.0-flash' }).code,
    ).toBe('gemini');
  });

  test('complete() builds contents/systemInstruction and maps candidates back', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'hello there' }] } }],
        usageMetadata: { promptTokenCount: 6, candidatesTokenCount: 2 },
      }),
    });
    const provider = new GeminiProvider({
      apiKey: 'k',
      model: 'gemini-2.0-flash',
      fetchImpl,
    });
    const result = await provider.complete({ messages: MESSAGES });
    expect(result).toEqual({
      content: 'hello there',
      model: 'gemini-2.0-flash',
      usage: { promptTokens: 6, completionTokens: 2 },
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('generateContent?key=k');
    const body = JSON.parse(options.body);
    expect(body.systemInstruction.parts[0].text).toBe('Be helpful.');
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }]);
  });

  test('complete() throws ExternalServiceError with no API key', async () => {
    const provider = new GeminiProvider({
      apiKey: '',
      model: 'gemini-2.0-flash',
    });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('stream() reassembles candidate text deltas from SSE frames', async () => {
    const sse =
      'data: {"candidates":[{"content":{"parts":[{"text":"hel"}]}}]}\n\n' +
      'data: {"candidates":[{"content":{"parts":[{"text":"lo"}]}}]}\n\n';
    const encoder = new TextEncoder();
    async function* body() {
      yield encoder.encode(sse);
    }
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, body: body() });
    const provider = new GeminiProvider({
      apiKey: 'k',
      model: 'gemini-2.0-flash',
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
