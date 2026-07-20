/**
 * Booking-Holds module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response. No business logic, no direct database access.
 */

import { toHoldBatchResponse, toHoldResponse } from '../dto/bookingHoldDto.js';

export function createBookingHoldController(bookingHoldsService) {
  return {
    async create(req, res, next) {
      try {
        const result = await bookingHoldsService.createHolds(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toHoldBatchResponse(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const holds = await bookingHoldsService.listHolds(req.principal);
        res.status(200).json({
          success: true,
          data: holds.map(toHoldResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async release(req, res, next) {
      try {
        const { holdIds } = req.validated.body;
        await bookingHoldsService.releaseHolds(req.principal, holdIds);
        res.status(200).json({
          success: true,
          data: { released: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createBookingHoldController;
