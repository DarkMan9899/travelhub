import { describe, test, expect, jest } from '@jest/globals';
import { AzureOpenAiProvider } from '../../../../src/modules/ai/providers/azureOpenAiProvider.js';
import { ExternalServiceError } from '../../../../src/errors/AppError.js';

const MESSAGES = [{ role: 'user', content: 'hi' }];
const FULL_CONFIG = {
  apiKey: 'k',
  endpoint: 'https://my-resource.openai.azure.com',
  deployment: 'gpt-deployment',
  apiVersion: '2024-06-01',
};

describe('AzureOpenAiProvider', () => {
  test('code is "azure_openai"', () => {
    expect(new AzureOpenAiProvider(FULL_CONFIG).code).toBe('azure_openai');
  });

  test('complete() builds the deployment URL and maps a chat-completions response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        model: 'gpt-deployment',
        choices: [{ message: { content: 'hello there' } }],
        usage: { prompt_tokens: 7, completion_tokens: 2 },
      }),
    });
    const provider = new AzureOpenAiProvider({ ...FULL_CONFIG, fetchImpl });
    const result = await provider.complete({ messages: MESSAGES });
    expect(result).toEqual({
      content: 'hello there',
      model: 'gpt-deployment',
      usage: { promptTokens: 7, completionTokens: 2 },
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(
      'https://my-resource.openai.azure.com/openai/deployments/gpt-deployment/chat/completions?api-version=2024-06-01',
    );
    expect(options.headers['api-key']).toBe('k');
  });

  test('complete() throws ExternalServiceError when any required config is missing', async () => {
    const provider = new AzureOpenAiProvider({
      ...FULL_CONFIG,
      deployment: '',
    });
    await expect(
      provider.complete({ messages: MESSAGES }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
