import { describe, test, expect, jest } from '@jest/globals';
import { AnthropicProvider } from '../../../../src/modules/ai/providers/anthropicProvider.js';
import { ExternalServiceError } from '../../../../src/errors/AppError.js';

const MESSAGES = [
  { role: 'system', content: 'Be helpful.' },
  { role: 'user', content: 'hi' },
];

describe('AnthropicProvider', () => {
  test('code is "anthropic"', () => {
    expect(
      new AnthropicProvider({ apiKey: 'k', model: 'claude-sonnet-5' }).code,
    ).toBe('anthropic');
  });

  test('complete() splits system from messages and maps content blocks', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'claude-sonnet-5',
        content: [{ type: 'text', text: 'hello there' }],
        usage: { input_tokens: 8, output_tokens: 3 },
      }),
    });
    const provider = new AnthropicProvider({
      apiKey: 'k',
      model: 'claude-sonnet-5',
      fetchImpl,
    });
    const result = await provider.complete({ messages: MESSAGES });
    expect(result).toEqual({
      content: 'hello there',
      model: 'claude-sonnet-5',
      usage: { promptTokens: 8, completionTokens: 3 },
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('k');
    const body = JSON.parse(options.body);
    expect(body.system).toBe('Be helpful.');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  test('complete() throws ExternalServiceError with no API key', async () => {
    const provider = new AnthropicProvider({
      apiKey: '',
      model: 'claude-sonnet-5',
    });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('stream() parses content_block_delta events into chunks', async () => {
    const sse =
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"hel"}}\n\n' +
      'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"text":"lo"}}\n\n' +
      'event: message_stop\ndata: {"type":"message_stop"}\n\n';
    const encoder = new TextEncoder();
    async function* body() {
      yield encoder.encode(sse);
    }
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, body: body() });
    const provider = new AnthropicProvider({
      apiKey: 'k',
      model: 'claude-sonnet-5',
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
