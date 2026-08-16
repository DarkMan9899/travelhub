/**
 * Notifications module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md
 * §10) — structural/format validation only. Ownership checks live in
 * `NotificationService`, never here.
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

export const listNotificationsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    status: z.enum(['all', 'unread', 'archived']).optional(),
    category: z.string().trim().max(30).optional(),
    search: z.string().trim().max(255).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const notificationIdParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

export const preferenceCategoryParamsSchema = z.object({
  params: z.object({ category: z.string().trim().max(30) }),
  query: passthroughQuery,
  body: z.object({
    inAppEnabled: z.boolean(),
    emailEnabled: z.boolean(),
  }),
});

export const createAnnouncementSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    audience: z.union([
      z.object({ type: z.literal('ALL') }),
      z.object({
        type: z.literal('ROLE'),
        roles: z.array(z.string().trim().min(1)).min(1),
      }),
    ]),
    priorityCode: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    payload: z.object({
      title: z.string().trim().min(1).max(255),
      body: z.string().trim().max(4000).optional(),
    }),
  }),
});
