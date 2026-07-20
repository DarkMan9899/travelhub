/**
 * Bookings module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). Every route requires authentication — there is no
 * public/unauthenticated view of a booking, unlike Listings/Availability's
 * public browse surfaces.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  createBookingSchema,
  bookingIdParamsSchema,
  rejectBookingSchema,
  cancelBookingSchema,
  listBookingsQuerySchema,
} from './validators/bookingValidators.js';

export default function createBookingRoutes({ bookingController, guards }) {
  const router = Router();
  const { requireAuth } = guards;

  router.post(
    '/',
    requireAuth,
    validate(createBookingSchema),
    bookingController.create,
  );

  router.get(
    '/',
    requireAuth,
    validate(listBookingsQuerySchema),
    bookingController.list,
  );

  router.get(
    '/:id',
    requireAuth,
    validate(bookingIdParamsSchema),
    bookingController.get,
  );

  router.post(
    '/:id/confirm',
    requireAuth,
    validate(bookingIdParamsSchema),
    bookingController.confirm,
  );

  router.post(
    '/:id/reject',
    requireAuth,
    validate(rejectBookingSchema),
    bookingController.reject,
  );

  router.post(
    '/:id/cancel',
    requireAuth,
    validate(cancelBookingSchema),
    bookingController.cancel,
  );

  router.post(
    '/:id/complete',
    requireAuth,
    validate(bookingIdParamsSchema),
    bookingController.complete,
  );

  router.post(
    '/:id/no-show',
    requireAuth,
    validate(bookingIdParamsSchema),
    bookingController.noShow,
  );

  return router;
}
