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
import { assertPartnerCapability } from '../../partners/authorization/partnerAuthorization.js';
import { PARTNER_CAPABILITIES } from '../../../core/domain/partnerCapabilities.js';

// P1.5 (Master Roadmap) — the outcome APPROVED/REJECTED/FLAGGED/PENDING
// is only notification-worthy on REJECTED (see eventTypes.js's own
// comment); this is the full set `PATCH /reviews/admin/:id
// /moderation-status` accepts, mirroring `listingService.js`'s
// `LISTING_MODERATION_STATUSES`.
const REVIEW_MODERATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'FLAGGED',
];

export class ReviewService {
  #reviewRepository;

  #bookingService;

  #listingService;

  #permissionResolver;

  #auditLogger;

  #eventBus;

  constructor({
    reviewRepository,
    bookingService,
    listingService,
    permissionResolver,
    auditLogger,
    eventBus = createNoOpEventBus(),
  }) {
    this.#reviewRepository = reviewRepository;
    this.#bookingService = bookingService;
    this.#listingService = listingService;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
  }

  /** Mirrors `listingService.js`/`partnerService.js`'s identical private helper. */
  async #assertPermission(principal, permissionKey) {
    if (!principal) throw new AuthenticationError();
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      permissionKey,
    );
    if (!granted) throw new AuthorizationError();
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

  /**
   * P1.5 (Master Roadmap) — `GET /reviews/admin`, the moderation queue.
   * Requires `review.moderate` outright (no owner fallback — a
   * moderator queuing every listing's reviews is never "the owner"),
   * mirroring `listingService.js#listListingsAdmin` exactly.
   */
  async listReviewsAdmin(principal, filters = {}, paginationOpts = {}) {
    await this.#assertPermission(principal, 'review.moderate');
    return this.#reviewRepository.listAdmin({ ...filters, ...paginationOpts });
  }

  /** `GET /reviews/admin/:id` — full detail plus every report filed against it. */
  async getReviewAdminDetail(principal, id) {
    await this.#assertPermission(principal, 'review.moderate');
    const review = await this.#reviewRepository.findByIdAdmin(id);
    if (!review) throw new NotFoundError('Review not found.');
    const reports = await this.#reviewRepository.listReportsForReview(id);
    return { ...review, reports };
  }

  /**
   * `PATCH /reviews/admin/:id/moderation-status` — the first real write
   * to `reviews.status_id` since auto-approval at submission time.
   * `notes` is optional free text (e.g. a removal reason), surfaced to
   * the review's author on REJECTED.
   */
  async updateModerationStatus(principal, id, statusCode, notes = null) {
    if (!REVIEW_MODERATION_STATUSES.includes(statusCode)) {
      throw new ValidationError('Invalid moderation status.');
    }
    await this.#assertPermission(principal, 'review.moderate');

    const before = await this.#reviewRepository.findByIdAdmin(id);
    if (!before) throw new NotFoundError('Review not found.');

    const updated = await this.#reviewRepository.updateModerationStatus(
      id,
      statusCode,
      notes,
      principal.userId,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'review.moderation_status_changed',
      targetType: 'review',
      targetId: id,
      beforeSnapshot: { statusCode: before.statusCode },
      afterSnapshot: { statusCode, notes },
    });

    if (statusCode === 'REJECTED') {
      await this.#eventBus.publish(
        createDomainEvent({
          eventType: EVENT_TYPES.REVIEW_REJECTED,
          actorId: principal.userId,
          resourceType: 'review',
          resourceId: id,
          payload: {
            reviewId: id,
            customerUserId: before.customerUserId,
            notes,
          },
        }),
      );
    }

    return updated;
  }

  /**
   * P1.5 (Master Roadmap) — a customer reports a review. Any
   * authenticated user (not just the listing's other reviewers or
   * bookers — reporting abusive/spam content should never be gated
   * behind having bought something, same "open by design" reasoning
   * `partnerService.js#applyToBecomePartner` already applies to a
   * different action). The table's own unique constraint is the final
   * guarantee against a duplicate report from the same customer; the
   * pre-check below only exists to return a friendly 409 instead of a
   * raw duplicate-key error, matching `submitReview`'s own idiom.
   */
  async reportReview(principal, reviewId, { reasonCode, details }) {
    if (!principal) throw new AuthenticationError();

    const review = await this.#reviewRepository.findById(reviewId);
    if (!review) throw new NotFoundError('Review not found.');

    const reasonId =
      await this.#reviewRepository.findReasonIdByCode(reasonCode);
    if (!reasonId) {
      throw new ValidationError('Invalid report reason.', [
        { field: 'reasonCode', issue: 'INVALID' },
      ]);
    }

    const report = await this.#reviewRepository.createReport({
      reviewId,
      reporterUserId: principal.userId,
      reasonId,
      details: details?.trim() || null,
    });

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'review.reported',
      targetType: 'review',
      targetId: reviewId,
      afterSnapshot: { reasonCode },
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.REVIEW_REPORTED,
        actorId: principal.userId,
        resourceType: 'review',
        resourceId: reviewId,
        payload: {
          reviewId,
          reasonName: report.reasonName,
        },
      }),
    );

    return report;
  }

  /**
   * P1.5 (Master Roadmap) — resolves the partner that owns a review's
   * listing, and asserts the caller has `RESPOND_TO_REVIEWS` for it.
   * `getListing(null, ...)` (no principal): a review only ever exists on
   * a listing that was PUBLISHED when the underlying booking happened,
   * which `getListing` returns to any caller including `null` — the
   * rare case of a since-unpublished/archived listing correctly falls
   * back to `NotFoundError` here rather than silently granting access.
   */
  async #assertCanRespondToReview(principal, review) {
    if (!principal) throw new AuthenticationError();
    const listing = await this.#listingService.getListing(
      null,
      review.listingId,
    );
    await assertPartnerCapability(
      principal,
      listing.partnerId,
      PARTNER_CAPABILITIES.RESPOND_TO_REVIEWS,
    );
    return listing;
  }

  /**
   * `PUT /reviews/:id/reply` — only ever on a currently-public
   * (APPROVED, non-deleted) review, matching `findById`'s own visibility
   * rule: replying to a review nobody can see would be pointless, and a
   * review an admin has since REJECTED/FLAGGED is exactly the case that
   * should read as "not found" here too.
   */
  async replyToReview(principal, reviewId, responseText) {
    const review = await this.#reviewRepository.findById(reviewId);
    if (!review) throw new NotFoundError('Review not found.');

    await this.#assertCanRespondToReview(principal, review);

    const updated = await this.#reviewRepository.setVendorResponse(
      reviewId,
      responseText,
      principal.userId,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'review.replied',
      targetType: 'review',
      targetId: reviewId,
      beforeSnapshot: { vendorResponse: review.vendorResponse },
      afterSnapshot: { vendorResponse: responseText },
    });

    return updated;
  }

  /** `DELETE /reviews/:id/reply` — clears an existing reply. Same authorization as writing one. */
  async deleteReviewReply(principal, reviewId) {
    const review = await this.#reviewRepository.findById(reviewId);
    if (!review) throw new NotFoundError('Review not found.');

    await this.#assertCanRespondToReview(principal, review);

    const updated = await this.#reviewRepository.setVendorResponse(
      reviewId,
      null,
      principal.userId,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'review.reply_deleted',
      targetType: 'review',
      targetId: reviewId,
      beforeSnapshot: { vendorResponse: review.vendorResponse },
      afterSnapshot: { vendorResponse: null },
    });

    return updated;
  }
}

export default ReviewService;
