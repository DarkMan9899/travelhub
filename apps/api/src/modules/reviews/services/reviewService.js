/**
 * ReviewService — public Service for the Reviews module (Phase 12,
 * Product Polish: minimal Reviews module — see the plan's Scope
 * decision #1). Depends on `BookingService`'s public interface only to
 * verify booking ownership/status, never a second Repository over
 * `bookings` (BACKEND_ARCHITECTURE.md §4's cross-module rule).
 */

import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../../../errors/AppError.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

export class ReviewService {
  #reviewRepository;

  #bookingService;

  #auditLogger;

  #eventBus;

  constructor({
    reviewRepository,
    bookingService,
    auditLogger,
    eventBus = createNoOpEventBus(),
  }) {
    this.#reviewRepository = reviewRepository;
    this.#bookingService = bookingService;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
  }

  /**
   * A booking is reviewable once it's `COMPLETED`, by its own customer,
   * exactly once (the table's `UNIQUE(booking_id)` constraint is the
   * final guarantee — this pre-check exists only to return a friendly
   * 409 instead of a raw duplicate-key error).
   */
  async submitReview(principal, bookingId, { rating, title, content }) {
    if (!principal) throw new AuthenticationError();

    const booking = await this.#bookingService.getBooking(principal, bookingId);
    if (booking.customerUserId !== principal.userId) {
      throw new AuthorizationError(
        'Only the customer on this booking can leave a review.',
      );
    }
    if (booking.statusCode !== 'COMPLETED') {
      throw new ValidationError('Only completed bookings can be reviewed.', [
        { field: 'bookingId', issue: 'BOOKING_NOT_COMPLETED' },
      ]);
    }

    const existing = await this.#reviewRepository.findByBookingId(bookingId);
    if (existing) {
      throw new ConflictError('This booking has already been reviewed.');
    }

    const review = await this.#reviewRepository.create({
      customerUserId: principal.userId,
      bookingId,
      listingId: booking.listingId,
      rating,
      title,
      content,
    });

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'review.submitted',
      targetType: 'review',
      targetId: review.id,
      afterSnapshot: { bookingId, listingId: booking.listingId, rating },
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.REVIEW_SUBMITTED,
        actorId: principal.userId,
        resourceType: 'review',
        resourceId: review.id,
        payload: {
          listingId: booking.listingId,
          partnerId: booking.partnerId,
          bookingId,
          rating,
        },
      }),
    );

    return review;
  }

  /** Public — the booking a viewer might want to review, or has already reviewed. */
  async getReviewForBooking(principal, bookingId) {
    if (!principal) throw new AuthenticationError();
    const booking = await this.#bookingService.getBooking(principal, bookingId);
    if (booking.customerUserId !== principal.userId) {
      throw new NotFoundError('Booking not found.');
    }
    return this.#reviewRepository.findByBookingId(bookingId);
  }

  /** Public — reviews for a listing's detail page. */
  async listReviewsForListing(listingId, paginationOpts = {}) {
    return this.#reviewRepository.listByListingId(listingId, paginationOpts);
  }

  /** Public — the rating badge shown on a single listing (detail page, company profile). */
  async getSummaryForListing(listingId) {
    return this.#reviewRepository.getSummaryForListingId(listingId);
  }

  /** Public — bulk lookup for a grid of cards (search results, company listing grid). */
  async getSummariesForListingIds(listingIds) {
    return this.#reviewRepository.getSummariesForListingIds(listingIds);
  }
}

export default ReviewService;
