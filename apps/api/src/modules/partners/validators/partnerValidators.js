/**
 * Partners module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10).
 * Phase 10: the module's first request-shape validation, for the two
 * new public Companies endpoints.
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();

export const listPublicPartnersQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const partnerSlugParamsSchema = z.object({
  params: z.object({ slug: z.string().trim().min(1).max(180) }),
  query: passthroughQuery,
  body: z.any(),
});

// Phase 11 Admin Platform.
export const userIdParamsSchema = z.object({
  params: z.object({ userId: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

// Stage 11.2 (Partner Management) — admin-scoped endpoints.
export const listPartnersAdminQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    keyword: z.string().trim().min(1).max(180).optional(),
    verificationStatus: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    moderationStatus: z.enum(['APPROVED', 'FLAGGED']).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const partnerIdParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

export const updateVerificationStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  }),
});

export const updateModerationStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.object({
    status: z.enum(['APPROVED', 'FLAGGED']),
  }),
});
