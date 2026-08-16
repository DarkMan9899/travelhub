import { describe, test, expect, jest } from '@jest/globals';
import { AiService } from '../../../../src/modules/ai/services/aiService.js';
import {
  ExternalServiceError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

function buildService({ providerOverrides = {}, cacheOverrides = {} } = {}) {
  const provider = {
    code: 'local',
    complete: jest.fn().mockResolvedValue({
      content: 'hello',
      model: 'local-heuristic-v1',
      usage: { promptTokens: 5, completionTokens: 3 },
    }),
    stream: jest.fn(),
    ...providerOverrides,
  };
  const providerRegistry = {
    getDefaultProvider: jest.fn(() => provider),
    getProvider: jest.fn(() => provider),
  };
  const aiCacheService = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    ...cacheOverrides,
  };
  const aiUsageService = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new AiService({
    providerRegistry,
    aiCacheService,
    aiUsageService,
    maxRetries: 2,
  });
  return {
    service,
    provider,
    providerRegistry,
    aiCacheService,
    aiUsageService,
  };
}

const MESSAGES = [{ role: 'user', content: 'hi' }];

describe('AiService', () => {
  describe('complete', () => {
    test('calls the provider on a cache miss and records usage', async () => {
      const { service, provider, aiUsageService, aiCacheService } =
        buildService();
      const result = await service.complete({
        principal: { userId: 1 },
        featureCode: 'assistant',
        messages: MESSAGES,
      });
      expect(provider.complete).toHaveBeenCalledTimes(1);
      expect(result.content).toBe('hello');
      expect(result.cacheHit).toBe(false);
      expect(aiCacheService.set).toHaveBeenCalledWith(
        'assistant',
        'local',
        MESSAGES,
        {
          content: 'hello',
          model: 'local-heuristic-v1',
          usage: { promptTokens: 5, completionTokens: 3 },
        },
      );
      expect(aiUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          cacheHit: false,
          succeeded: true,
        }),
      );
    });

    test('returns the cached response and skips calling the provider on a cache hit', async () => {
      const cached = { content: 'cached answer', model: 'local-heuristic-v1' };
      const { service, provider, aiCacheService, aiUsageService } =
        buildService({
          cacheOverrides: { get: jest.fn().mockResolvedValue(cached) },
        });
      const result = await service.complete({
        featureCode: 'assistant',
        messages: MESSAGES,
      });
      expect(provider.complete).not.toHaveBeenCalled();
      expect(result).toEqual({
        ...cached,
        providerCode: 'local',
        cacheHit: true,
      });
      expect(aiCacheService.get).toHaveBeenCalled();
      expect(aiUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({ cacheHit: true, succeeded: true }),
      );
    });

    test('retries on ExternalServiceError up to maxRetries, then succeeds', async () => {
      const complete = jest
        .fn()
        .mockRejectedValueOnce(new ExternalServiceError('transient'))
        .mockResolvedValueOnce({
          content: 'ok on retry',
          model: 'local-heuristic-v1',
          usage: { promptTokens: 1, completionTokens: 1 },
        });
      const { service } = buildService({ providerOverrides: { complete } });
      const result = await service.complete({
        featureCode: 'assistant',
        messages: MESSAGES,
      });
      expect(complete).toHaveBeenCalledTimes(2);
      expect(result.content).toBe('ok on retry');
    }, 10000);

    test('gives up after maxRetries and records the failure', async () => {
      const err = new ExternalServiceError('always fails');
      const complete = jest.fn().mockRejectedValue(err);
      const { service, aiUsageService } = buildService({
        providerOverrides: { complete },
      });
      await expect(
        service.complete({ featureCode: 'assistant', messages: MESSAGES }),
      ).rejects.toBe(err);
      expect(complete).toHaveBeenCalledTimes(3); // initial + 2 retries
      expect(aiUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({ succeeded: false }),
      );
    }, 10000);

    test('never retries a non-transient error', async () => {
      const err = new ValidationError('bad input');
      const complete = jest.fn().mockRejectedValue(err);
      const { service } = buildService({ providerOverrides: { complete } });
      await expect(
        service.complete({ featureCode: 'assistant', messages: MESSAGES }),
      ).rejects.toBe(err);
      expect(complete).toHaveBeenCalledTimes(1);
    });
  });

  describe('stream', () => {
    test('yields every chunk and records usage from the final chunk', async () => {
      async function* fakeStream() {
        yield { delta: 'hel', done: false };
        yield { delta: 'lo', done: false };
        yield {
          delta: '',
          done: true,
          model: 'local-heuristic-v1',
          usage: { promptTokens: 2, completionTokens: 2 },
        };
      }
      const { service, aiUsageService } = buildService({
        providerOverrides: { stream: fakeStream },
      });
      const chunks = [];
      for await (const chunk of service.stream({
        featureCode: 'assistant',
        messages: MESSAGES,
      })) {
        chunks.push(chunk);
      }
      expect(chunks.map((c) => c.delta).join('')).toBe('hello');
      expect(aiUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          promptTokens: 2,
          completionTokens: 2,
          succeeded: true,
        }),
      );
    });

    test('records a failure and rethrows when the provider stream throws mid-stream', async () => {
      const err = new ExternalServiceError('stream broke');
      // eslint-disable-next-line require-yield -- deliberately throws before yielding
      async function* failingStream() {
        throw err;
      }
      const { service, aiUsageService } = buildService({
        providerOverrides: { stream: failingStream },
      });
      const iterator = service.stream({
        featureCode: 'assistant',
        messages: MESSAGES,
      });
      await expect(iterator.next()).rejects.toBe(err);
      expect(aiUsageService.record).toHaveBeenCalledWith(
        expect.objectContaining({ succeeded: false }),
      );
    });
  });
});
