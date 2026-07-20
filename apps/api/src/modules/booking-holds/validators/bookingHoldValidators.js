/**
 * Booking-Holds module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md
 * §10) — structural/format validation only. Capacity, blackout-veto, and
 * ownership checks are Layer 3 and live in `AvailabilityService`/
 * `BookingHoldsService`, never here (same split
 * `availabilityValidators.js` documents).
 */

import { z } from 'zod';
import { isoDateSchema } from '../../../validation/isoDate.js';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

const holdItemSchema = z
  .object({
    bookableUnitId: z.coerce.number().int().positive(),
    dateFrom: isoDateSchema,
    dateTo: isoDateSchema,
    quantity: z.coerce.number().int().positive().default(1),
  })
  .refine((data) => data.dateTo >= data.dateFrom, {
    message: 'dateTo must not be before dateFrom.',
    path: ['dateTo'],
  });

export const createHoldsSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    items: z.array(holdItemSchema).min(1),
  }),
});

export const releaseHoldsSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    holdIds: z
      .array(z.coerce.number().int().positive())
      .min(1)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'holdIds must not contain duplicates.',
      }),
  }),
});

export const listHoldsQuerySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.any(),
});
