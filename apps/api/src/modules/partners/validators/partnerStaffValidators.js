/**
 * Partner staff/invitation Zod validators (P1.4, Master Roadmap).
 * `ASSIGNABLE_ROLES` deliberately excludes OWNER — see
 * `partnerStaffService.js`'s own `ASSIGNABLE_ROLE_CODES` comment; kept as
 * a second, independent copy (not imported from the Service) so a 422
 * on a bad role never depends on Service internals being reachable from
 * the validation layer, matching this codebase's existing Layer
 * separation (Zod schemas never import from `services/`).
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();

const ASSIGNABLE_ROLES = [
  'MANAGER',
  'BOOKING_MANAGER',
  'EDITOR',
  'ANALYTICS_VIEWER',
];

export const partnerStaffParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    employeeId: z.coerce.number().int().positive(),
  }),
  query: passthroughQuery,
  body: z.any(),
});

export const inviteStaffSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.object({
    email: z.string().trim().email().max(255),
    roleCode: z.enum(ASSIGNABLE_ROLES),
    // The dashboard's own current UI locale — same explicit-locale
    // convention `updateProfileSchema` (P1.3) established, since there is
    // no recipient `preferred_language_id` to resolve for an invitee who
    // may not have an account yet.
    locale: z.enum(['en', 'hy', 'ru']),
  }),
});

export const updateStaffRoleSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    employeeId: z.coerce.number().int().positive(),
  }),
  query: passthroughQuery,
  body: z.object({
    roleCode: z.enum(ASSIGNABLE_ROLES),
  }),
});

export const invitationIdParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    invitationId: z.coerce.number().int().positive(),
  }),
  query: passthroughQuery,
  body: z.any(),
});

export const invitationTokenParamsSchema = z.object({
  params: z.object({ token: z.string().trim().length(64) }),
  query: passthroughQuery,
  body: z.any(),
});
