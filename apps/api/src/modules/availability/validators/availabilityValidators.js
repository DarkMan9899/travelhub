/**
 * Availability module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md
 * §10) — structural/format validation only. Overlap detection, listing/
 * unit existence, and ownership are Layer 3 (database-dependent) concerns
 * and live in the Services, never here (BOOKING_ENGINE_ARCHITECTURE.md
 * §11.1). `status`/`bookableUnitType` are validated against the real,
 * reused domain enums (`CALENDAR_DAY_STATUSES`/`BOOKABLE_UNIT_TYPES`)
 * rather than re-declared string literals.
 */

import { z } from 'zod';
import { CALENDAR_DAY_STATUSES } from '../../../core/domain/calendarExpansion.js';
import { BOOKABLE_UNIT_TYPES } from '../../../core/domain/bookableUnitTypes.js';
import { isoDateSchema } from '../../../validation/isoDate.js';

const MAX_CALENDAR_SPAN_DAYS = 366;

const idParams = z.object({ id: z.coerce.number().int().positive() });
const listingIdParams = z.object({
  listingId: z.coerce.number().int().positive(),
});
const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

const paginationShape = {
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
};

// --- bookable_units (inventory-agnostic capability — see
// availabilityService.js's header comment: unit creation is always an
// explicit call, never a side effect of a calendar write) ---

export const registerUnitSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    listingId: z.coerce.number().int().positive(),
    bookableUnitType: z.enum(BOOKABLE_UNIT_TYPES),
    capacity: z.coerce.number().int().positive().optional(),
  }),
});

export const unitIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const listUnitsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    listingId: z.coerce.number().int().positive(),
  }),
  body: z.any(),
});

// --- availability_calendar (primary engine) ---

/** Both-or-neither: a price override is meaningless without its currency. */
function refinePriceOverridePair(data, ctx) {
  const hasAmount = data.priceOverrideAmount !== undefined;
  const hasCurrency = data.priceOverrideCurrency !== undefined;
  if (hasAmount !== hasCurrency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'priceOverrideAmount and priceOverrideCurrency must be provided together.',
      path: ['priceOverrideCurrency'],
    });
  }
}

export const setAvailabilitySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z
    .object({
      unitId: z.coerce.number().int().positive(),
      dateFrom: isoDateSchema,
      dateTo: isoDateSchema,
      status: z.enum(CALENDAR_DAY_STATUSES).default('AVAILABLE'),
      quantityAvailable: z.coerce.number().int().min(0).optional(),
      priceOverrideAmount: z.coerce.number().positive().optional(),
      priceOverrideCurrency: z
        .string()
        .trim()
        .length(3)
        .toUpperCase()
        .optional(),
    })
    .refine((data) => data.dateTo >= data.dateFrom, {
      message: 'dateTo must not be before dateFrom.',
      path: ['dateTo'],
    })
    .superRefine(refinePriceOverridePair),
});

export const updateCalendarEntrySchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z
    .object({
      status: z.enum(CALENDAR_DAY_STATUSES).optional(),
      quantityAvailable: z.coerce.number().int().min(0).optional(),
      priceOverrideAmount: z.coerce.number().positive().optional(),
      priceOverrideCurrency: z
        .string()
        .trim()
        .length(3)
        .toUpperCase()
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided.',
    })
    .superRefine(refinePriceOverridePair),
});

export const calendarEntryIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const listCalendarQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    listingId: z.coerce.number().int().positive().optional(),
    unitId: z.coerce.number().int().positive().optional(),
    partnerId: z.coerce.number().int().positive().optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    ...paginationShape,
  }),
  body: z.any(),
});

// --- blackout_dates (complementary veto layer) ---

export const createBlackoutSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z
    .object({
      listingId: z.coerce.number().int().positive(),
      dateFrom: isoDateSchema,
      dateTo: isoDateSchema,
      reason: z.string().trim().max(500).optional(),
    })
    .refine((data) => data.dateTo >= data.dateFrom, {
      message: 'dateTo must not be before dateFrom.',
      path: ['dateTo'],
    }),
});

export const updateBlackoutSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z
    .object({
      dateFrom: isoDateSchema.optional(),
      dateTo: isoDateSchema.optional(),
      reason: z.string().trim().max(500).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided.',
    })
    .refine(
      (data) => !(data.dateFrom && data.dateTo) || data.dateTo >= data.dateFrom,
      { message: 'dateTo must not be before dateFrom.', path: ['dateTo'] },
    ),
});

export const blackoutIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const listBlackoutsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    listingId: z.coerce.number().int().positive().optional(),
    partnerId: z.coerce.number().int().positive().optional(),
    ...paginationShape,
  }),
  body: z.any(),
});

// --- public views ---

export const listingIdParamsSchema = z.object({
  params: listingIdParams,
  query: passthroughQuery,
  body: z.any(),
});

export const calendarQuerySchema = z.object({
  params: listingIdParams,
  query: z
    .object({
      from: isoDateSchema,
      to: isoDateSchema,
      unitId: z.coerce.number().int().positive().optional(),
    })
    .refine((data) => data.to >= data.from, {
      message: 'to must not be before from.',
      path: ['to'],
    })
    .refine(
      (data) => {
        const spanDays =
          (new Date(`${data.to}T00:00:00Z`).getTime() -
            new Date(`${data.from}T00:00:00Z`).getTime()) /
          86_400_000;
        return spanDays <= MAX_CALENDAR_SPAN_DAYS;
      },
      {
        message: `The calendar span cannot exceed ${MAX_CALENDAR_SPAN_DAYS} days.`,
        path: ['to'],
      },
    ),
  body: z.any(),
});
