/**
 * CMS module Zod validators — Stage 11.6 Admin Platform. Structural
 * validation only (layer 2); slug-uniqueness/page-existence failures
 * surface from the service/repository (layer 3).
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();
const idParams = z.object({ id: z.coerce.number().int().positive() });
const noBody = z.any();

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Slug must be lowercase, hyphen-separated.',
  );

export const publicPageParamsSchema = z.object({
  params: z.object({ slug: slugSchema }),
  query: z.object({ locale: z.string().trim().min(2).max(5).optional() }),
  body: noBody,
});

export const idParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: noBody,
});

export const createPageSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    slug: slugSchema,
    isPublished: z.coerce.boolean().optional().default(false),
  }),
});

export const updatePageSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.object({
    slug: slugSchema,
    isPublished: z.coerce.boolean(),
  }),
});

export const upsertTranslationSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    languageCode: z.string().trim().min(2).max(5),
  }),
  query: passthroughQuery,
  body: z.object({
    title: z.string().trim().min(1).max(255),
    content: z.string().trim().min(1).max(100_000),
  }),
});
