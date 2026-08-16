/**
 * Marketplace Configuration module Zod validators — Stage 11.5 Admin
 * Platform. Structural validation only (layer 2); uniqueness/FK-existence
 * failures surface from the repository via `mapMysqlError` (layer 3).
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();
const idParams = z.object({ id: z.coerce.number().int().positive() });
const noBody = z.any();

export const idParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: noBody,
});

export const categoryBodySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    name: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        'Slug must be lowercase, hyphen-separated.',
      ),
    parentId: z.coerce.number().int().positive().nullable().optional(),
  }),
});

export const updateCategorySchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: categoryBodySchema.shape.body,
});

export const amenityBodySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    name: z.string().trim().min(1).max(150),
    amenityGroupId: z.coerce.number().int().positive().nullable().optional(),
  }),
});

export const updateAmenitySchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: amenityBodySchema.shape.body,
});

export const pricingModelBodySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(30)
      .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be SCREAMING_SNAKE_CASE.'),
    name: z.string().trim().min(1).max(100),
  }),
});

export const updatePricingModelSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: pricingModelBodySchema.shape.body,
});

export const countryBodySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    isoCode: z
      .string()
      .trim()
      .length(2)
      .regex(/^[A-Z]{2}$/, 'ISO code must be two uppercase letters.'),
    name: z.string().trim().min(1).max(150),
  }),
});

export const updateCountrySchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: countryBodySchema.shape.body,
});

export const listRegionsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    countryId: z.coerce.number().int().positive().optional(),
  }),
  body: noBody,
});

export const regionBodySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    countryId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(150),
  }),
});

export const updateRegionSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: regionBodySchema.shape.body,
});

export const listCitiesQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    regionId: z.coerce.number().int().positive().optional(),
  }),
  body: noBody,
});

export const cityBodySchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    regionId: z.coerce.number().int().positive(),
    name: z.string().trim().min(1).max(150),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(180)
      .regex(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
        'Slug must be lowercase, hyphen-separated.',
      ),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  }),
});

export const updateCitySchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: cityBodySchema.shape.body,
});
