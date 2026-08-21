/**
 * Reviews module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). Listing reviews are public reads; submitting/checking
 * a review requires authentication (a review is always tied to the
 * requester's own booking).
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  submitReviewSchema,
  listReviewsQuerySchema,
  bookingIdParamsSchema,
  reviewIdParamsSchema,
  listReviewsAdminQuerySchema,
  updateReviewModerationStatusSchema,
  reportReviewSchema,
  replyToReviewSchema,
} from './validators/reviewValidators.js';

export default function createReviewRoutes({ reviewController, guards }) {
  const router = Router();
  const { requireAuth, requirePermission } = guards;

  router.post(
    '/',
    requireAuth,
    validate(submitReviewSchema),
    reviewController.submit,
  );

  router.get(
    '/',
    validate(listReviewsQuerySchema),
    reviewController.listForListing,
  );

  router.get(
    '/booking/:bookingId',
    requireAuth,
    validate(bookingIdParamsSchema),
    reviewController.getForBooking,
  );

  // P1.5 (Master Roadmap) — Review Trust & Safety, `/admin*`, registered
  // before `/:id`-shaped routes below for the usual collision-avoidance
  // reason (every other admin-moderation module in this codebase does
  // the same). Each route's permission is enforced again inside
  // `ReviewService` (defense in depth) — the guard here is the
  // fast-fail layer.
  router.get(
    '/admin',
    requireAuth,
    requirePermission('review.moderate'),
    validate(listReviewsAdminQuerySchema),
    reviewController.listAdmin,
  );
  router.get(
    '/admin/:id',
    requireAuth,
    requirePermission('review.moderate'),
    validate(reviewIdParamsSchema),
    reviewController.getAdminDetail,
  );
  router.patch(
    '/admin/:id/moderation-status',
    requireAuth,
    requirePermission('review.moderate'),
    validate(updateReviewModerationStatusSchema),
    reviewController.updateModerationStatus,
  );

  // Reporting is open to any authenticated user (see
  // `reviewService.js#reportReview`'s own comment) — no
  // `requirePermission` here, `requireAuth` is the only gate.
  router.post(
    '/:id/report',
    requireAuth,
    validate(reportReviewSchema),
    reviewController.report,
  );

  // P1.5 (Master Roadmap) — a partner's reply to a review. No
  // `requirePermission` here: unlike admin moderation (a global
  // permission), this is a partner-scoped capability resolved from the
  // review's own listing/partner, enforced inside `ReviewService`
  // (`#assertCanRespondToReview`) — `requireAuth` is the fast-fail gate,
  // the same "service enforces the real check" split every other
  // partner-scoped write in this codebase uses.
  router.put(
    '/:id/reply',
    requireAuth,
    validate(replyToReviewSchema),
    reviewController.reply,
  );
  router.delete(
    '/:id/reply',
    requireAuth,
    validate(reviewIdParamsSchema),
    reviewController.deleteReply,
  );

  return router;
}
