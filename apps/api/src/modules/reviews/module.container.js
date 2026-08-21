/**
 * Reviews module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `bookingService`/`listingService` as injected dependencies
 * (constructed by `routes/v1.js` after the Bookings/Listings
 * containers) — never a second Repository over `bookings`/`listings`,
 * the same cross-module rule every other module in this codebase
 * already follows.
 *
 * P1.5 (Master Roadmap): also takes `permissionResolver` — the
 * module's first permission-gated mutations (admin moderation), and
 * `listingService` — resolving a review's owning partner for the
 * partner-reply capability check.
 */

import { MySqlReviewRepository } from './repositories/mysqlReviewRepository.js';
import { ReviewService } from './services/reviewService.js';
import { createReviewController } from './controllers/reviewController.js';

export default function createReviewsContainer({
  bookingService,
  listingService,
  permissionResolver,
  auditLogger,
  eventBus,
}) {
  const reviewRepository = new MySqlReviewRepository();
  const reviewService = new ReviewService({
    reviewRepository,
    bookingService,
    listingService,
    permissionResolver,
    auditLogger,
    eventBus,
  });
  const reviewController = createReviewController(reviewService);

  return {
    reviewRepository,
    reviewService,
    reviewController,
  };
}
