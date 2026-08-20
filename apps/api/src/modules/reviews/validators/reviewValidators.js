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

// P1.5 (Master Roadmap) — Review Trust & Safety.

export const reviewIdParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

export const listReviewsAdminQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    moderationStatus: z
      .enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'])
      .optional(),
    // `z.coerce.boolean()` is a footgun for a query string: it calls
    // `Boolean(value)`, and `Boolean('false')` is `true` (any non-empty
    // string is truthy) — `?hasReports=false` would otherwise silently
    // mean "true". Only the literal strings 'true'/'false' are accepted.
    hasReports: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) =>
        value === undefined ? undefined : value === 'true',
      ),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const updateReviewModerationStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']),
    notes: z.string().trim().max(500).optional(),
  }),
});

const REPORT_REASON_CODES = ['SPAM', 'ABUSIVE', 'OFF_TOPIC', 'FAKE', 'OTHER'];

export const reportReviewSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.object({
    reasonCode: z.enum(REPORT_REASON_CODES),
    details: z.string().trim().max(1000).optional(),
  }),
});
