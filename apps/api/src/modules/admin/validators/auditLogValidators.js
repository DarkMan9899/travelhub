/**
 * Audit Log module Zod validators — Stage 11.7 Admin Platform.
 * View-only: a single list query schema, no body/param schemas.
 */

import { z } from 'zod';

export const listAuditLogsQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    actorId: z.coerce.number().int().positive().optional(),
    targetType: z.string().trim().min(1).max(50).optional(),
    targetId: z.coerce.number().int().positive().optional(),
    action: z.string().trim().min(1).max(100).optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});
