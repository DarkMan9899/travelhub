import { describe, test, expect, jest } from '@jest/globals';
import { ReviewService } from '../../../../src/modules/reviews/services/reviewService.js';
import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };
const COMPLETED_BOOKING = {
  id: 10,
  customerUserId: 1,
  listingId: 5,
  statusCode: 'COMPLETED',
};

function buildService(overrides = {}) {
  const reviewRepository = {
    findByBookingId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 99, ...overrides.createResult }),
    listByListingId: jest.fn(),
    getSummaryForListingId: jest.fn(),
    getSummariesForListingIds: jest.fn(),
    ...overrides.reviewRepository,
  };
  const bookingService = {
    getBooking: jest.fn().mockResolvedValue(COMPLETED_BOOKING),
    ...overrides.bookingService,
  };
  const auditLogger = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new ReviewService({
    reviewRepository,
    bookingService,
    auditLogger,
  });
  return { service, reviewRepository, bookingService, auditLogger };
}

describe('ReviewService.submitReview', () => {
  test('creates a review for a completed booking owned by the principal and audit-logs it', async () => {
    const { service, reviewRepository, auditLogger } = buildService();

    const result = await service.submitReview(PRINCIPAL, 10, {
      rating: 5,
      title: 'Great stay',
      content: 'Loved it',
    });

    expect(reviewRepository.create).toHaveBeenCalledWith({
      customerUserId: 1,
      bookingId: 10,
      listingId: 5,
      rating: 5,
      title: 'Great stay',
      content: 'Loved it',
    });
    expect(auditLogger.record).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(99);
  });

  test('throws AuthenticationError with no principal', async () => {
    const { service } = buildService();
    await expect(
      service.submitReview(null, 10, { rating: 5 }),
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  test('throws AuthorizationError when the requester is not the booking customer', async () => {
    const { service } = buildService({
      bookingService: {
        getBooking: jest
          .fn()
          .mockResolvedValue({ ...COMPLETED_BOOKING, customerUserId: 2 }),
      },
    });
    await expect(
      service.submitReview(PRINCIPAL, 10, { rating: 5 }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  test('throws ValidationError when the booking is not COMPLETED', async () => {
    const { service } = buildService({
      bookingService: {
        getBooking: jest
          .fn()
          .mockResolvedValue({ ...COMPLETED_BOOKING, statusCode: 'CONFIRMED' }),
      },
    });
    await expect(
      service.submitReview(PRINCIPAL, 10, { rating: 5 }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('throws ConflictError when the booking already has a review', async () => {
    const { service } = buildService({
      reviewRepository: {
        findByBookingId: jest.fn().mockResolvedValue({ id: 1 }),
      },
    });
    await expect(
      service.submitReview(PRINCIPAL, 10, { rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('ReviewService.getReviewForBooking', () => {
  test("returns null when no review exists yet for the caller's own booking", async () => {
    const { service } = buildService();
    const result = await service.getReviewForBooking(PRINCIPAL, 10);
    expect(result).toBeNull();
  });

  test('throws NotFoundError when the booking belongs to someone else', async () => {
    const { service } = buildService({
      bookingService: {
        getBooking: jest
          .fn()
          .mockResolvedValue({ ...COMPLETED_BOOKING, customerUserId: 2 }),
      },
    });
    await expect(
      service.getReviewForBooking(PRINCIPAL, 10),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ReviewService read methods', () => {
  test('listReviewsForListing delegates to the repository', async () => {
    const { service, reviewRepository } = buildService();
    reviewRepository.listByListingId.mockResolvedValue({
      rows: [],
      meta: { has_more: false },
    });
    await service.listReviewsForListing(5, { limit: 20 });
    expect(reviewRepository.listByListingId).toHaveBeenCalledWith(5, {
      limit: 20,
    });
  });

  test('getSummaryForListing delegates to the repository', async () => {
    const { service, reviewRepository } = buildService();
    reviewRepository.getSummaryForListingId.mockResolvedValue({
      ratingAverage: 4.5,
      reviewCount: 2,
    });
    const result = await service.getSummaryForListing(5);
    expect(result).toEqual({ ratingAverage: 4.5, reviewCount: 2 });
  });
});
