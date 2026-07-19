/**
 * Availability module route wiring (BACKEND_ARCHITECTURE.md §2: route
 * wiring only, no logic).
 *
 * Three groups: `bookable_units` CRUD under `/units` (the inventory-
 * agnostic capability — see `availabilityService.js`'s header comment:
 * unit creation is always an explicit call, never an automatic side
 * effect of writing a calendar entry), `availability_calendar` CRUD (the
 * primary engine, consumes an existing `unitId`), `blackout_dates` CRUD
 * under `/blackouts` (the complementary veto layer — deliberately its
 * own sub-path, never conflated with the calendar resource), and two
 * public views.
 *
 * **Route-order hazard**: `GET /units`, `GET /blackouts`, and
 * `GET /:listingId` are all single-segment `GET` routes. Express matches
 * by registration order when path shapes collide, so `/units` and
 * `/blackouts` MUST both be registered before `/:listingId` — otherwise
 * e.g. `GET /availability/units` would be captured by `/:listingId`
 * (coercing "units" as a listing id and failing validation) instead of
 * reaching the unit list. `/:listingId/calendar` has no such hazard
 * (different segment count).
 *
 * The public GETs skip `requireAuth` — `authenticate.js` still populates
 * `req.principal` when a token is present, which `AvailabilityService`
 * uses so an owner viewing their own draft listing still works, same
 * pattern as `listingController.get`.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  registerUnitSchema,
  unitIdParamsSchema,
  listUnitsQuerySchema,
  setAvailabilitySchema,
  updateCalendarEntrySchema,
  calendarEntryIdParamsSchema,
  listCalendarQuerySchema,
  createBlackoutSchema,
  updateBlackoutSchema,
  blackoutIdParamsSchema,
  listBlackoutsQuerySchema,
  listingIdParamsSchema,
  calendarQuerySchema,
} from './validators/availabilityValidators.js';

export default function createAvailabilityRoutes({
  availabilityController,
  guards,
}) {
  const router = Router();
  const { requireAuth } = guards;

  // --- bookable_units (inventory-agnostic capability) ---
  // Must be registered before the `/:listingId` public route below.
  router.post(
    '/units',
    requireAuth,
    validate(registerUnitSchema),
    availabilityController.registerUnit,
  );
  router.get(
    '/units',
    requireAuth,
    validate(listUnitsQuerySchema),
    availabilityController.listUnits,
  );
  router.delete(
    '/units/:id',
    requireAuth,
    validate(unitIdParamsSchema),
    availabilityController.retireUnit,
  );

  // --- availability_calendar (primary engine) ---
  router.post(
    '/',
    requireAuth,
    validate(setAvailabilitySchema),
    availabilityController.setAvailability,
  );
  router.get(
    '/',
    requireAuth,
    validate(listCalendarQuerySchema),
    availabilityController.listCalendarEntries,
  );
  router.patch(
    '/:id',
    requireAuth,
    validate(updateCalendarEntrySchema),
    availabilityController.updateCalendarEntry,
  );
  router.delete(
    '/:id',
    requireAuth,
    validate(calendarEntryIdParamsSchema),
    availabilityController.removeCalendarEntry,
  );

  // --- blackout_dates (complementary veto layer) ---
  // Must be registered before the `/:listingId` public route below.
  router.post(
    '/blackouts',
    requireAuth,
    validate(createBlackoutSchema),
    availabilityController.createBlackout,
  );
  router.get(
    '/blackouts',
    requireAuth,
    validate(listBlackoutsQuerySchema),
    availabilityController.listBlackouts,
  );
  router.patch(
    '/blackouts/:id',
    requireAuth,
    validate(updateBlackoutSchema),
    availabilityController.updateBlackout,
  );
  router.delete(
    '/blackouts/:id',
    requireAuth,
    validate(blackoutIdParamsSchema),
    availabilityController.removeBlackout,
  );

  // --- public views ---
  router.get(
    '/:listingId/calendar',
    validate(calendarQuerySchema),
    availabilityController.getCalendar,
  );
  router.get(
    '/:listingId',
    validate(listingIdParamsSchema),
    availabilityController.getPublicRanges,
  );

  return router;
}
