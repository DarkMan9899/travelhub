import { describe, test, expect, jest } from '@jest/globals';
import { AiSearchService } from '../../../../src/modules/ai/services/aiSearchService.js';
import {
  AuthenticationError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

const FILTER_GROUPS = [
  {
    code: 'amenities',
    definitions: [
      {
        code: 'amenities',
        valueSource: 'AMENITY',
        options: [
          { value: 101, code: 'Pool' },
          { value: 102, code: 'Free Wi-Fi' },
        ],
      },
    ],
  },
];

function buildService(overrides = {}) {
  const searchService = {
    searchCategories: jest.fn().mockResolvedValue([
      { id: 5, name: 'Hotels' },
      { id: 6, name: 'Apartments' },
    ]),
    getFilterDefinitions: jest.fn().mockResolvedValue(FILTER_GROUPS),
    ...overrides.searchService,
  };
  const aiService = {
    complete: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        parsedFilters: {},
        originalQuery: 'hotels with a pool in yerevan',
      }),
      providerCode: 'local',
      cacheHit: false,
    }),
    ...overrides.aiService,
  };
  const service = new AiSearchService({ searchService, aiService });
  return { service, searchService, aiService };
}

describe('AiSearchService', () => {
  test('parseQuery requires a principal', async () => {
    const { service } = buildService();
    await expect(
      service.parseQuery(null, { query: 'hotels in yerevan' }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  test('parseQuery rejects an empty query', async () => {
    const { service } = buildService();
    await expect(
      service.parseQuery(PRINCIPAL, { query: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('matches free-text against real category names, never inventing one', async () => {
    const { service, searchService } = buildService();
    const result = await service.parseQuery(PRINCIPAL, {
      query: 'hotels with a pool in yerevan',
    });
    expect(searchService.searchCategories).toHaveBeenCalled();
    expect(result.categoryId).toBe(5);
    expect(result.categoryName).toBe('Hotels');
  });

  test('returns no category when nothing in the query matches a real one', async () => {
    const { service } = buildService();
    const result = await service.parseQuery(PRINCIPAL, {
      query: 'somewhere quiet by the lake',
    });
    expect(result.categoryId).toBeNull();
    expect(result.amenityIds).toEqual([]);
  });

  test('matches amenity ids against the resolved category real filter catalog, not invented ones', async () => {
    const { service, searchService } = buildService();
    const result = await service.parseQuery(PRINCIPAL, {
      query: 'hotels with a pool in yerevan',
    });
    expect(searchService.getFilterDefinitions).toHaveBeenCalledWith(5);
    expect(result.amenityIds).toEqual([101]);
  });

  test('never calls getFilterDefinitions when no category was resolved', async () => {
    const { service, searchService } = buildService();
    await service.parseQuery(PRINCIPAL, { query: 'somewhere with a pool' });
    expect(searchService.getFilterDefinitions).not.toHaveBeenCalled();
  });

  test('falls back to the raw query text when the AI response is not parseable JSON', async () => {
    const { service } = buildService({
      aiService: {
        complete: jest.fn().mockResolvedValue({
          content: 'Cozy hotels with a pool near Yerevan',
          providerCode: 'openai',
          cacheHit: false,
        }),
      },
    });
    const result = await service.parseQuery(PRINCIPAL, {
      query: 'hotels with a pool in yerevan',
    });
    expect(result.keyword).toBe('Cozy hotels with a pool near Yerevan');
  });

  test('calls the AI gateway with the SEARCH_PARSE feature code, never a provider directly', async () => {
    const { service, aiService } = buildService();
    await service.parseQuery(PRINCIPAL, { query: 'hotels in yerevan' });
    expect(aiService.complete).toHaveBeenCalledWith(
      expect.objectContaining({ featureCode: 'search_parse' }),
    );
  });
});
