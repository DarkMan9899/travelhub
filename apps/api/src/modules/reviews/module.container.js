/**
 * Reviews module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `bookingService` as an injected dependency (constructed by
 * `routes/v1.js` after the Bookings container) — never a second
 * Repository over `bookings`, the same cross-module rule every other
 * module in this codebase already follows.
 */

import { MySqlReviewRepository } from './repositories/mysqlReviewRepository.js';
import { ReviewService } from './services/reviewService.js';
import { createReviewController } from './controllers/reviewController.js';

export default function createReviewsContainer({
  bookingService,
  auditLogger,
  eventBus,
}) {
  const reviewRepository = new MySqlReviewRepository();
  const reviewService = new ReviewService({
    reviewRepository,
    bookingService,
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
