/**
 * Reviews module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response. No business logic, no direct database access.
 */

import { toReviewResponse, toReviewSummaryResponse } from '../dto/reviewDto.js';

export function createReviewController(reviewService) {
  return {
    async submit(req, res, next) {
      try {
        const review = await reviewService.submitReview(
          req.principal,
          req.validated.body.bookingId,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toReviewResponse(review),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getForBooking(req, res, next) {
      try {
        const { bookingId } = req.validated.params;
        const review = await reviewService.getReviewForBooking(
          req.principal,
          bookingId,
        );
        res.status(200).json({
          success: true,
          data: review ? toReviewResponse(review) : null,
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listForListing(req, res, next) {
      try {
        const { listingId, cursor, limit } = req.validated.query;
        const [{ rows, meta }, summary] = await Promise.all([
          reviewService.listReviewsForListing(listingId, {
            cursor,
            limit: limit ?? 20,
          }),
          reviewService.getSummaryForListing(listingId),
        ]);
        res.status(200).json({
          success: true,
          data: rows.map(toReviewResponse),
          meta: {
            ...meta,
            ...toReviewSummaryResponse({ listingId, ...summary }),
          },
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createReviewController;
