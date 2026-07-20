/**
 * Booking-Holds module route wiring (BACKEND_ARCHITECTURE.md §2: route
 * wiring only, no logic). Every route requires authentication — holds
 * are always self-service (a customer's own holds), never an admin/
 * partner-management view, since `reservation_holds` has no
 * ownership-adjacent use case beyond "the customer currently checking out."
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  createHoldsSchema,
  releaseHoldsSchema,
  listHoldsQuerySchema,
} from './validators/bookingHoldValidators.js';

export default function createBookingHoldRoutes({
  bookingHoldController,
  guards,
}) {
  const router = Router();
  const { requireAuth } = guards;

  router.post(
    '/',
    requireAuth,
    validate(createHoldsSchema),
    bookingHoldController.create,
  );

  router.get(
    '/',
    requireAuth,
    validate(listHoldsQuerySchema),
    bookingHoldController.list,
  );

  router.delete(
    '/',
    requireAuth,
    validate(releaseHoldsSchema),
    bookingHoldController.release,
  );

  return router;
}
