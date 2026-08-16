import { describe, test, expect, jest } from '@jest/globals';
import { TripPlannerService } from '../../../../src/modules/ai/services/tripPlannerService.js';
import {
  AuthenticationError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

const LISTINGS = [
  {
    id: 1,
    title: 'Central Hotel',
    slug: 'central-hotel',
    cityName: 'Yerevan',
    priceAmount: '100.00',
    priceCurrencyCode: 'AMD',
  },
  {
    id: 2,
    title: 'Lake View Cabin',
    slug: 'lake-view-cabin',
    cityName: 'Yerevan',
    priceAmount: '150.00',
    priceCurrencyCode: 'AMD',
  },
  {
    id: 3,
    title: 'Budget Inn',
    slug: 'budget-inn',
    cityName: 'Yerevan',
    priceAmount: '50.00',
    priceCurrencyCode: 'AMD',
  },
];

function buildService(overrides = {}) {
  const searchService = {
    findCityByName: jest.fn().mockResolvedValue({ id: 9, name: 'Yerevan' }),
    searchListings: jest.fn().mockResolvedValue({ rows: LISTINGS, meta: {} }),
    searchCategories: jest.fn().mockResolvedValue([
      { id: 5, name: 'Nature Tours' },
      { id: 6, name: 'Hotels' },
    ]),
    ...overrides.searchService,
  };
  const aiService = {
    complete: jest.fn().mockResolvedValue({
      content: 'Here is your trip narrative.',
      providerCode: 'local',
      model: 'local-heuristic-v1',
      usage: { promptTokens: 5, completionTokens: 5 },
      cacheHit: false,
    }),
    ...overrides.aiService,
  };
  const aiConversationService = {
    createConversation: jest.fn().mockResolvedValue({ id: 42 }),
    appendMessage: jest.fn().mockResolvedValue(undefined),
    getConversationWithMessages: jest
      .fn()
      .mockResolvedValue({ id: 42, messages: [] }),
    ...overrides.aiConversationService,
  };
  const service = new TripPlannerService({
    searchService,
    aiService,
    aiConversationService,
  });
  return { service, searchService, aiService, aiConversationService };
}

describe('TripPlannerService', () => {
  test('planTrip requires a principal', async () => {
    const { service } = buildService();
    await expect(
      service.planTrip(null, { destination: 'Yerevan', days: 3, budget: 500 }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  test('planTrip validates the days range', async () => {
    const { service } = buildService();
    await expect(
      service.planTrip(PRINCIPAL, {
        destination: 'Yerevan',
        days: 0,
        budget: 500,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.planTrip(PRINCIPAL, {
        destination: 'Yerevan',
        days: 31,
        budget: 500,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('planTrip rejects a destination that matches no real city', async () => {
    const { service } = buildService({
      searchService: { findCityByName: jest.fn().mockResolvedValue(null) },
    });
    await expect(
      service.planTrip(PRINCIPAL, {
        destination: 'Nowhereland',
        days: 2,
        budget: 500,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('builds a real, budget-respecting daily plan from real published listings', async () => {
    const { service } = buildService();
    const plan = await service.planTrip(PRINCIPAL, {
      destination: 'Yerevan',
      days: 2,
      budget: 200,
    });
    expect(plan.destination).toBe('Yerevan');
    expect(plan.dailyPlan).toHaveLength(2);
    const allListingIds = plan.dailyPlan.flatMap((day) =>
      day.listings.map((l) => l.id),
    );
    // Sorted ascending by price (50, 100), so the 150 listing plus the
    // first two would exceed the 200 budget and must be excluded.
    expect(allListingIds).toEqual(expect.arrayContaining([3, 1]));
    expect(plan.totalEstimatedBudget).toBeLessThanOrEqual(200);
  });

  test('never exceeds the supplied budget even when more listings exist', async () => {
    const { service } = buildService();
    const plan = await service.planTrip(PRINCIPAL, {
      destination: 'Yerevan',
      days: 1,
      budget: 60,
    });
    expect(plan.totalEstimatedBudget).toBeLessThanOrEqual(60);
  });

  test('resolves the city via a real DB lookup, never trusting the AI provider with it', async () => {
    const { service, searchService } = buildService();
    await service.planTrip(PRINCIPAL, {
      destination: 'Yerevan',
      days: 1,
      budget: 500,
    });
    expect(searchService.findCityByName).toHaveBeenCalledWith('Yerevan');
    expect(searchService.searchListings).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ cityId: 9 }),
    );
  });

  test('matches free-text interests against real category names, not invented ones', async () => {
    const { service, searchService } = buildService();
    await service.planTrip(PRINCIPAL, {
      destination: 'Yerevan',
      days: 1,
      budget: 500,
      interests: ['nature'],
    });
    expect(searchService.searchCategories).toHaveBeenCalled();
    expect(searchService.searchListings).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ categoryId: 5 }),
    );
  });

  test('persists the conversation and both messages, returning the conversationId', async () => {
    const { service, aiConversationService } = buildService();
    const plan = await service.planTrip(PRINCIPAL, {
      destination: 'Yerevan',
      days: 1,
      budget: 500,
    });
    expect(plan.conversationId).toBe(42);
    expect(aiConversationService.createConversation).toHaveBeenCalledWith(
      PRINCIPAL,
      expect.objectContaining({ featureCode: 'trip_planner' }),
    );
    expect(aiConversationService.appendMessage).toHaveBeenCalledTimes(2);
  });

  test('getTrip delegates to aiConversationService.getConversationWithMessages', async () => {
    const { service, aiConversationService } = buildService();
    await service.getTrip(PRINCIPAL, 42);
    expect(
      aiConversationService.getConversationWithMessages,
    ).toHaveBeenCalledWith(PRINCIPAL, 42);
  });
});
