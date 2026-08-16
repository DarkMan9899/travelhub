import { describe, test, expect, jest } from '@jest/globals';
import { registerAiListeners } from '../../../../src/modules/ai/events/aiListener.js';
import { EVENT_TYPES } from '../../../../src/core/events/eventTypes.js';
import { createDomainEvent } from '../../../../src/core/events/createDomainEvent.js';

function buildFakeEventBus() {
  const handlers = new Map();
  return {
    subscribe: jest.fn((eventType, handler) => {
      handlers.set(eventType, handler);
      return () => handlers.delete(eventType);
    }),
    async emit(eventType, event) {
      const handler = handlers.get(eventType);
      if (!handler) throw new Error(`No handler registered for ${eventType}`);
      await handler(event);
    },
  };
}

const LISTING = {
  categoryIds: [3],
  location: { cityId: 9, cityName: 'Yerevan' },
};

function buildDeps() {
  const aiMemoryService = {
    recordCategoryAffinity: jest.fn().mockResolvedValue(undefined),
    recordDestinationAffinity: jest.fn().mockResolvedValue(undefined),
  };
  const listingService = { getListing: jest.fn().mockResolvedValue(LISTING) };
  const bookingService = {
    getBooking: jest.fn().mockResolvedValue({ listingId: 42 }),
  };
  return { aiMemoryService, listingService, bookingService };
}

describe('registerAiListeners', () => {
  test('favorite.added updates category and destination affinity from the real listing', async () => {
    const eventBus = buildFakeEventBus();
    const { aiMemoryService, listingService, bookingService } = buildDeps();
    registerAiListeners({
      eventBus,
      aiMemoryService,
      bookingService,
      listingService,
    });

    await eventBus.emit(
      EVENT_TYPES.FAVORITE_ADDED,
      createDomainEvent({
        eventType: EVENT_TYPES.FAVORITE_ADDED,
        actorId: 5,
        resourceType: 'listing',
        resourceId: 10,
        payload: { listingId: 10, partnerId: 1 },
      }),
    );

    expect(listingService.getListing).toHaveBeenCalledWith(null, 10);
    expect(aiMemoryService.recordCategoryAffinity).toHaveBeenCalledWith(
      5,
      '3',
      '3',
    );
    expect(aiMemoryService.recordDestinationAffinity).toHaveBeenCalledWith(
      5,
      '9',
      'Yerevan',
    );
  });

  test('review.submitted updates affinity from the reviewed listing', async () => {
    const eventBus = buildFakeEventBus();
    const { aiMemoryService, listingService, bookingService } = buildDeps();
    registerAiListeners({
      eventBus,
      aiMemoryService,
      bookingService,
      listingService,
    });

    await eventBus.emit(
      EVENT_TYPES.REVIEW_SUBMITTED,
      createDomainEvent({
        eventType: EVENT_TYPES.REVIEW_SUBMITTED,
        actorId: 6,
        resourceType: 'review',
        resourceId: 20,
        payload: { listingId: 11, partnerId: 1, bookingId: 99, rating: 5 },
      }),
    );

    expect(listingService.getListing).toHaveBeenCalledWith(null, 11);
    expect(aiMemoryService.recordCategoryAffinity).toHaveBeenCalledWith(
      6,
      '3',
      '3',
    );
  });

  test('review.submitted with a rating below 4 is skipped, never recorded as positive affinity', async () => {
    const eventBus = buildFakeEventBus();
    const { aiMemoryService, listingService, bookingService } = buildDeps();
    registerAiListeners({
      eventBus,
      aiMemoryService,
      bookingService,
      listingService,
    });

    await eventBus.emit(
      EVENT_TYPES.REVIEW_SUBMITTED,
      createDomainEvent({
        eventType: EVENT_TYPES.REVIEW_SUBMITTED,
        actorId: 6,
        resourceType: 'review',
        resourceId: 21,
        payload: { listingId: 11, partnerId: 1, bookingId: 98, rating: 2 },
      }),
    );

    expect(listingService.getListing).not.toHaveBeenCalled();
    expect(aiMemoryService.recordCategoryAffinity).not.toHaveBeenCalled();
    expect(aiMemoryService.recordDestinationAffinity).not.toHaveBeenCalled();
  });

  test('review.submitted with no rating in the payload is treated as unscored, not positive by default', async () => {
    const eventBus = buildFakeEventBus();
    const { aiMemoryService, listingService, bookingService } = buildDeps();
    registerAiListeners({
      eventBus,
      aiMemoryService,
      bookingService,
      listingService,
    });

    await eventBus.emit(
      EVENT_TYPES.REVIEW_SUBMITTED,
      createDomainEvent({
        eventType: EVENT_TYPES.REVIEW_SUBMITTED,
        actorId: 6,
        resourceType: 'review',
        resourceId: 22,
        payload: { listingId: 11, partnerId: 1, bookingId: 97 },
      }),
    );

    expect(listingService.getListing).not.toHaveBeenCalled();
    expect(aiMemoryService.recordCategoryAffinity).not.toHaveBeenCalled();
  });

  test("booking.completed resolves the listing via bookingService using the booking's own customer", async () => {
    const eventBus = buildFakeEventBus();
    const { aiMemoryService, listingService, bookingService } = buildDeps();
    registerAiListeners({
      eventBus,
      aiMemoryService,
      bookingService,
      listingService,
    });

    await eventBus.emit(
      EVENT_TYPES.BOOKING_COMPLETED,
      createDomainEvent({
        eventType: EVENT_TYPES.BOOKING_COMPLETED,
        actorId: 7,
        resourceType: 'booking',
        resourceId: 42,
        payload: { bookingReference: 'BK-1', partnerId: 1, customerUserId: 7 },
      }),
    );

    expect(bookingService.getBooking).toHaveBeenCalledWith(
      { userId: 7, roles: [] },
      42,
    );
    expect(listingService.getListing).toHaveBeenCalledWith(null, 42);
    expect(aiMemoryService.recordDestinationAffinity).toHaveBeenCalledWith(
      7,
      '9',
      'Yerevan',
    );
  });

  test('a resolution failure is swallowed, never rethrown to the publisher', async () => {
    const eventBus = buildFakeEventBus();
    const { aiMemoryService, bookingService } = buildDeps();
    const listingService = {
      getListing: jest.fn().mockRejectedValue(new Error('listing gone')),
    };
    registerAiListeners({
      eventBus,
      aiMemoryService,
      bookingService,
      listingService,
    });

    await expect(
      eventBus.emit(
        EVENT_TYPES.FAVORITE_ADDED,
        createDomainEvent({
          eventType: EVENT_TYPES.FAVORITE_ADDED,
          actorId: 5,
          resourceType: 'listing',
          resourceId: 10,
          payload: { listingId: 10, partnerId: 1 },
        }),
      ),
    ).resolves.toBeUndefined();
    expect(aiMemoryService.recordCategoryAffinity).not.toHaveBeenCalled();
  });
});
