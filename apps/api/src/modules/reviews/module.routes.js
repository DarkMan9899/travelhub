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
} from './validators/reviewValidators.js';

export default function createReviewRoutes({ reviewController, guards }) {
  const router = Router();
  const { requireAuth } = guards;

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

  return router;
}
