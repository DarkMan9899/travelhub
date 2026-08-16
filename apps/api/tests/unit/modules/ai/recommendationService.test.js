import { describe, test, expect, jest } from '@jest/globals';
import { RecommendationService } from '../../../../src/modules/ai/services/recommendationService.js';
import { AuthenticationError } from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

const LISTINGS = [
  { id: 1, title: 'Central Hotel', slug: 'central-hotel', priceAmount: 100 },
  { id: 2, title: 'Lake View Cabin', slug: 'lake-view-cabin', priceAmount: 60 },
];

function buildService(overrides = {}) {
  const aiMemoryService = {
    getMemoryForUser: jest.fn().mockResolvedValue([
      { key: 'category_affinity:5', value: { label: 'Hotels', count: 3 } },
      { key: 'category_affinity:6', value: { label: 'Tours', count: 1 } },
      {
        key: 'destination_affinity:9',
        value: { label: 'Yerevan', count: 2 },
      },
    ]),
    ...overrides.aiMemoryService,
  };
  const searchService = {
    searchListings: jest.fn().mockResolvedValue({ rows: LISTINGS, meta: {} }),
    ...overrides.searchService,
  };
  const aiService = {
    complete: jest.fn().mockResolvedValue({
      content: 'Here are some hotels in Yerevan you might like.',
      providerCode: 'local',
      cacheHit: false,
    }),
    ...overrides.aiService,
  };
  const { bookingService } = overrides;
  const service = new RecommendationService({
    aiMemoryService,
    searchService,
    aiService,
    bookingService,
  });
  return { service, aiMemoryService, searchService, aiService, bookingService };
}

describe('RecommendationService', () => {
  test('getRecommendations requires a principal', async () => {
    const { service } = buildService();
    await expect(service.getRecommendations(null)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  test('picks the highest-count category/city affinity, never an arbitrary one', async () => {
    const { service, searchService } = buildService();
    const result = await service.getRecommendations(PRINCIPAL);
    expect(searchService.searchListings).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ categoryId: 5, cityId: 9 }),
    );
    expect(result.basedOn).toEqual({
      category: 'Hotels',
      city: 'Yerevan',
      typicalBudget: null,
    });
  });

  test('returns the real listings resolved from searchService, never fabricated ones', async () => {
    const { service } = buildService();
    const result = await service.getRecommendations(PRINCIPAL);
    expect(result.listings).toEqual(LISTINGS);
    expect(result.blurb).toBe(
      'Here are some hotels in Yerevan you might like.',
    );
  });

  test('returns an honest empty result for a user with no affinity signals yet, never a fake "popular" fallback', async () => {
    const { service, searchService, aiService } = buildService({
      aiMemoryService: { getMemoryForUser: jest.fn().mockResolvedValue([]) },
    });
    const result = await service.getRecommendations(PRINCIPAL);
    expect(result).toEqual({ listings: [], blurb: null, basedOn: null });
    expect(searchService.searchListings).not.toHaveBeenCalled();
    expect(aiService.complete).not.toHaveBeenCalled();
  });

  test('calls the AI gateway with the RECOMMENDATIONS feature code, never a provider directly', async () => {
    const { service, aiService } = buildService();
    await service.getRecommendations(PRINCIPAL);
    expect(aiService.complete).toHaveBeenCalledWith(
      expect.objectContaining({ featureCode: 'recommendations' }),
    );
  });

  test('backfills from the second-ranked category affinity when the primary search does not fill the page', async () => {
    const searchListings = jest
      .fn()
      .mockResolvedValueOnce({ rows: [LISTINGS[0]], meta: {} })
      .mockResolvedValueOnce({ rows: [LISTINGS[1]], meta: {} });
    const { service } = buildService({
      searchService: { searchListings },
    });

    const result = await service.getRecommendations(PRINCIPAL, { limit: 8 });

    expect(searchListings).toHaveBeenNthCalledWith(
      1,
      null,
      expect.objectContaining({ categoryId: 5, cityId: 9, limit: 8 }),
    );
    expect(searchListings).toHaveBeenNthCalledWith(
      2,
      null,
      expect.objectContaining({ categoryId: 6, cityId: 9, limit: 7 }),
    );
    expect(result.listings).toEqual([LISTINGS[0], LISTINGS[1]]);
  });

  test('does not duplicate a listing already returned by the primary affinity search', async () => {
    const searchListings = jest
      .fn()
      .mockResolvedValueOnce({ rows: [LISTINGS[0]], meta: {} })
      .mockResolvedValueOnce({ rows: [LISTINGS[0], LISTINGS[1]], meta: {} });
    const { service } = buildService({ searchService: { searchListings } });

    const result = await service.getRecommendations(PRINCIPAL, { limit: 8 });

    expect(result.listings).toEqual([LISTINGS[0], LISTINGS[1]]);
  });

  test("resolves a typical-budget signal from the user's own completed bookings and re-ranks toward it", async () => {
    const bookingService = {
      listBookings: jest.fn().mockResolvedValue({
        rows: [
          { totalAmount: '90', currencyCode: 'AMD' },
          { totalAmount: '70', currencyCode: 'AMD' },
        ],
        meta: {},
      }),
    };
    const { service } = buildService({ bookingService });

    const result = await service.getRecommendations(PRINCIPAL);

    expect(bookingService.listBookings).toHaveBeenCalledWith(
      PRINCIPAL,
      { status: 'COMPLETED' },
      { limit: 10 },
    );
    expect(result.basedOn.typicalBudget).toEqual({
      amount: 80,
      currency: 'AMD',
    });
  });

  test('re-ranks listings toward the resolved typical budget when it is unambiguous', async () => {
    const rows = [
      { id: 1, priceAmount: 200 },
      { id: 2, priceAmount: 55 },
    ];
    const bookingService = {
      listBookings: jest.fn().mockResolvedValue({
        rows: [{ totalAmount: '50', currencyCode: 'AMD' }],
        meta: {},
      }),
    };
    const { service } = buildService({
      bookingService,
      searchService: {
        searchListings: jest.fn().mockResolvedValue({ rows, meta: {} }),
      },
    });

    const result = await service.getRecommendations(PRINCIPAL);

    expect(result.listings.map((listing) => listing.id)).toEqual([2, 1]);
  });

  test('is null when the user has no completed bookings, never a fabricated "typical" figure', async () => {
    const bookingService = {
      listBookings: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    };
    const { service } = buildService({ bookingService });

    const result = await service.getRecommendations(PRINCIPAL);

    expect(result.basedOn.typicalBudget).toBeNull();
  });
});
