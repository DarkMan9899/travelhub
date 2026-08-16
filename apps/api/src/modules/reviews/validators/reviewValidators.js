/**
 * Reviews module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10) —
 * structural/format validation only. Booking ownership/status and the
 * one-review-per-booking rule are Layer 3 (database-dependent) concerns
 * and live in `ReviewService`, never here.
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

export const submitReviewSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    bookingId: z.coerce.number().int().positive(),
    rating: z.coerce.number().int().min(1).max(5),
    title: z.string().trim().max(255).optional(),
    content: z.string().trim().max(4000).optional(),
  }),
});

export const listReviewsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    listingId: z.coerce.number().int().positive(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const bookingIdParamsSchema = z.object({
  params: z.object({ bookingId: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});
