/**
 * Settings module Zod validators — Stage 11.9 Admin Platform. Structural
 * validation only (layer 2); duplicate-key/code failures surface from
 * the service/repository (layer 3), matching every other admin CRUD
 * module's convention.
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const idParams = z.object({ id: z.coerce.number().int().positive() });
const noBody = z.any();

export const idParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: noBody,
});

const keySchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9_]+$/,
    'Key must be lowercase letters, numbers, and underscores only.',
  );

export const settingBodySchema = z.object({
  params: z.object({}).passthrough(),
  query: passthroughQuery,
  body: z.object({
    key: keySchema,
    value: z.any(),
    description: z.string().trim().max(255).optional().nullable(),
  }),
});

export const updateSettingSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    key: keySchema,
    value: z.any(),
    description: z.string().trim().max(255).optional().nullable(),
  }),
});

const flagCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9_]+$/,
    'Code must be lowercase letters, numbers, and underscores only.',
  );

export const featureFlagBodySchema = z.object({
  params: z.object({}).passthrough(),
  query: passthroughQuery,
  body: z.object({
    code: flagCodeSchema,
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(255).optional().nullable(),
    isEnabled: z.coerce.boolean().optional().default(false),
  }),
});

export const updateFeatureFlagSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    code: flagCodeSchema,
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(255).optional().nullable(),
    isEnabled: z.coerce.boolean(),
  }),
});
