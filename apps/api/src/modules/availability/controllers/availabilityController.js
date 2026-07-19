/**
 * Availability module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response. No business logic, no direct database access.
 */

import {
  toBookableUnitResponse,
  toCalendarEntryResponse,
  toBlackoutManagementResponse,
  toPublicRangeResponse,
  toCalendarDayResponse,
} from '../dto/availabilityDto.js';

export function createAvailabilityController(availabilityService) {
  return {
    // --- bookable_units (inventory-agnostic capability) ---

    async registerUnit(req, res, next) {
      try {
        const unit = await availabilityService.registerUnit(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toBookableUnitResponse(unit),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async retireUnit(req, res, next) {
      try {
        const { id } = req.validated.params;
        await availabilityService.retireUnit(req.principal, id);
        res.status(200).json({
          success: true,
          data: { deleted: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listUnits(req, res, next) {
      try {
        const { listingId } = req.validated.query;
        const units = await availabilityService.listUnits(
          req.principal,
          listingId,
        );
        res.status(200).json({
          success: true,
          data: units.map(toBookableUnitResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    // --- availability_calendar (primary engine) ---

    async setAvailability(req, res, next) {
      try {
        const entries = await availabilityService.setAvailability(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: entries.map(toCalendarEntryResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateCalendarEntry(req, res, next) {
      try {
        const { id } = req.validated.params;
        const entry = await availabilityService.updateCalendarEntry(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toCalendarEntryResponse(entry),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async removeCalendarEntry(req, res, next) {
      try {
        const { id } = req.validated.params;
        await availabilityService.removeCalendarEntry(req.principal, id);
        res.status(200).json({
          success: true,
          data: { deleted: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listCalendarEntries(req, res, next) {
      try {
        const { listingId, unitId, partnerId, from, to, cursor, limit } =
          req.validated.query;
        const { rows, meta } = await availabilityService.listCalendarEntries(
          req.principal,
          { listingId, unitId, partnerId, from, to },
          { cursor, limit },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toCalendarEntryResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    // --- blackout_dates (complementary veto layer) ---

    async createBlackout(req, res, next) {
      try {
        const block = await availabilityService.createBlackout(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toBlackoutManagementResponse(block),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateBlackout(req, res, next) {
      try {
        const { id } = req.validated.params;
        const block = await availabilityService.updateBlackout(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toBlackoutManagementResponse(block),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async removeBlackout(req, res, next) {
      try {
        const { id } = req.validated.params;
        await availabilityService.deleteBlackout(req.principal, id);
        res.status(200).json({
          success: true,
          data: { deleted: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listBlackouts(req, res, next) {
      try {
        const { listingId, partnerId, cursor, limit } = req.validated.query;
        const { rows, meta } = await availabilityService.listBlackouts(
          req.principal,
          { listingId, partnerId },
          { cursor, limit },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toBlackoutManagementResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    // --- public views ---

    async getPublicRanges(req, res, next) {
      try {
        const { listingId } = req.validated.params;
        const ranges = await availabilityService.getPublicRanges(
          req.principal,
          listingId,
        );
        res.status(200).json({
          success: true,
          data: ranges.map(toPublicRangeResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getCalendar(req, res, next) {
      try {
        const { listingId } = req.validated.params;
        const { from, to, unitId } = req.validated.query;
        const days = await availabilityService.getCalendar(
          req.principal,
          listingId,
          from,
          to,
          unitId,
        );
        res.status(200).json({
          success: true,
          data: days.map(toCalendarDayResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAvailabilityController;
