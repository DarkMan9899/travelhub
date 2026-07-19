/**
 * Users module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10) —
 * structural/format validation only, from the request payload alone.
 * The avatar endpoint (`POST /users/:id/avatar`) uses a raw binary body
 * (`express.raw()`, scoped in `module.routes.js`), so it has no Zod
 * schema here — its MIME-type/size checks live in `mediaConstraints.js`
 * (Sprint 5) and are enforced in `UserService.setAvatar`.
 */

import { z } from 'zod';
import {
  isStrongPassword,
  PASSWORD_POLICY_DESCRIPTION,
} from '../../../core/domain/passwordPolicy.js';

const userIdParams = z.object({ id: z.coerce.number().int().positive() });
const passthroughQuery = z.object({}).passthrough();

export const updateProfileSchema = z.object({
  params: userIdParams,
  query: passthroughQuery,
  body: z
    .object({
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      phone: z.string().trim().min(3).max(30).optional(),
      preferredLanguageId: z.coerce.number().int().positive().optional(),
      preferredCurrencyId: z.coerce.number().int().positive().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided.',
    }),
});

export const changePasswordSchema = z.object({
  params: userIdParams,
  query: passthroughQuery,
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .refine(isStrongPassword, { message: PASSWORD_POLICY_DESCRIPTION }),
  }),
});

export const avatarParamsSchema = z.object({
  params: userIdParams,
  query: passthroughQuery,
  body: z.any(),
});
