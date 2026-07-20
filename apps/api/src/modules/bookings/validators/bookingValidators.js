/**
 * Bookings module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10) —
 * structural/format validation only. Hold ownership/expiry, listing/
 * unit-type/currency consistency across items, and pricing completeness
 * are Layer 3 (database-dependent) concerns and live in `BookingService`,
 * never here.
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();
const idParams = z.object({ id: z.coerce.number().int().positive() });

const guestSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  documentNumber: z.string().trim().max(100).optional(),
});

const bookingItemInputSchema = z.object({
  holdIds: z
    .array(z.coerce.number().int().positive())
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'holdIds must not contain duplicates.',
    }),
  guests: z.array(guestSchema).default([]),
});

const guestContactSnapshotSchema = z.object({
  fullName: z.string().trim().min(1).max(255),
  email: z.string().trim().email(),
  phone: z.string().trim().min(1).max(50).optional(),
});

export const createBookingSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    items: z.array(bookingItemInputSchema).min(1),
    guestContactSnapshot: guestContactSnapshotSchema,
    customerNotes: z.string().trim().max(2000).optional(),
  }),
});

export const bookingIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const rejectBookingSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    reason: z.string().trim().max(500).optional(),
  }),
});

export const cancelBookingSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    reason: z.string().trim().max(500).optional(),
  }),
});

export const listBookingsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    partnerId: z.coerce.number().int().positive().optional(),
    // `z.coerce.boolean()` would coerce the literal string "false" to
    // `true` (any non-empty string is truthy) — an explicit string
    // comparison is required for a query-string boolean.
    viewAll: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});
