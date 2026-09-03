/**
 * Auth module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10).
 *
 * Field naming deviates from `API_SPECIFICATION.md` §27's literal
 * `full_name` request field: the already-migrated `users` table
 * (Sprint 5) stores separate `first_name`/`last_name` columns, and
 * splitting a single "full name" string into first/last is lossy and
 * ambiguous for many real names — `firstName`/`lastName` map 1:1 onto
 * the accepted schema instead. See docs/SPRINT_6_AUTH_FOUNDATION.md.
 */

import { z } from 'zod';
import {
  isStrongPassword,
  PASSWORD_POLICY_DESCRIPTION,
} from '../../../core/domain/passwordPolicy.js';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

export const registerSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z
      .string()
      .refine(isStrongPassword, { message: PASSWORD_POLICY_DESCRIPTION }),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z.string().trim().min(3).max(30).optional(),
  }),
  query: passthroughQuery,
  params: passthroughParams,
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
  query: passthroughQuery,
  params: passthroughParams,
});

export const refreshSchema = z.object({
  // `refresh_token` may instead arrive via the httpOnly cookie web
  // clients rely on (FRONTEND_ARCHITECTURE.md §34.1) — optional here,
  // the controller falls back to req.cookies.
  body: z.object({
    refresh_token: z.string().min(1).optional(),
  }),
  query: passthroughQuery,
  params: passthroughParams,
});

const SUPPORTED_LOCALES = ['en', 'hy', 'ru'];

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    // Which of the email template's EN/HY/RU renderings to send — same
    // explicit-locale convention `partnerStaffService.js#inviteStaff`
    // already established (there is no signed-in session here to resolve
    // a preferred language from). Defaults to `en` rather than being
    // required: a client that omits it still gets a real, working email.
    locale: z.enum(SUPPORTED_LOCALES).default('en'),
  }),
  query: passthroughQuery,
  params: passthroughParams,
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1),
    newPassword: z
      .string()
      .refine(isStrongPassword, { message: PASSWORD_POLICY_DESCRIPTION }),
  }),
  query: passthroughQuery,
  params: passthroughParams,
});
