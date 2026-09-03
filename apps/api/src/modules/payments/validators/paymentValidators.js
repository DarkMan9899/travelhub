/**
 * Payments module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10) —
 * structural/format validation only. Refundable-amount checks, active-
 * payment-per-booking guards, and permission checks are Layer 3 concerns
 * and live in `PaymentService`, never here.
 */

import { z } from 'zod';
import { PAYMENT_STATUSES } from '../../../core/domain/paymentStatusTransitions.js';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();
const idParams = z.object({ id: z.coerce.number().int().positive() });

const decimalAmount = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, 'amount must be a positive decimal string.');

// Only meaningful for `LocalPaymentProvider` (Phase 16 spec §5) — a real
// provider adapter never reads this field for behavior, but Layer 2
// (this file) is shape-only by design and has no business-rule access to
// "which provider is currently active." `PaymentService#createPaymentIntent`
// (Layer 3) is what actually refuses this field outright whenever the
// configured provider isn't `local` — see its own comment. Release-
// architecture requirement: no demo/simulation control may be part of
// the real Stripe request contract, so this is a hard rejection, not a
// silently-ignored value.
const simulateScenarioEnum = z.enum([
  'SUCCESS',
  'DECLINE',
  'PROCESSING',
  'REQUIRES_ACTION',
]);

export const createPaymentSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    bookingId: z.coerce.number().int().positive(),
    idempotencyKey: z.string().trim().min(1).max(255).optional(),
    simulateScenario: simulateScenarioEnum.optional(),
  }),
});

export const paymentIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const listPaymentsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    partnerId: z.coerce.number().int().positive().optional(),
    bookingId: z.coerce.number().int().positive().optional(),
    viewAll: z
      .string()
      .optional()
      .transform((value) => value === 'true'),
    status: z.enum(PAYMENT_STATUSES).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const createRefundSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    amount: decimalAmount,
    reason: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().trim().min(1).max(255).optional(),
  }),
});

export const partnerBalanceParamsSchema = z.object({
  params: z.object({ partnerId: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

export const listLedgerQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    partnerId: z.coerce.number().int().positive().optional(),
    entryType: z.string().trim().max(40).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const providerWebhookParamsSchema = z.object({
  params: z.object({ providerCode: z.string().trim().min(1).max(30) }),
  query: passthroughQuery,
  body: z.any(),
});
