/**
 * Listings module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10) —
 * structural/format validation only, from the request payload alone.
 * Business-rule validation that requires a database read (slug
 * uniqueness, `UNKNOWN_LISTING_TYPE`, partner verification, publish
 * readiness) lives in `ListingService`, never here
 * (BOOKING_ENGINE_ARCHITECTURE.md §11.1).
 *
 * The media-upload endpoint uses a raw binary body (`express.raw()`,
 * scoped in `module.routes.js`), same pattern as
 * `modules/users/validators/userValidators.js`'s avatar route.
 */

import { z } from 'zod';
import { LISTING_STATUSES } from '../../../core/domain/listingStatusTransitions.js';

const idParams = z.object({ id: z.coerce.number().int().positive() });
const mediaIdParams = z.object({
  id: z.coerce.number().int().positive(),
  mediaId: z.coerce.number().int().positive(),
});
const passthroughQuery = z.object({}).passthrough();

const translationSchema = z.object({
  languageId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(255),
  summary: z.string().trim().max(500).optional(),
  description: z.string().trim().max(20000).optional(),
  seoTitle: z.string().trim().max(255).optional(),
  seoDescription: z.string().trim().max(500).optional(),
});

const locationSchema = z.object({
  addressId: z.coerce.number().int().positive().optional(),
  cityId: z.coerce.number().int().positive().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const positiveIdArray = z.array(z.coerce.number().int().positive());

export const listingIdParamsSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z.any(),
});

export const listingMediaIdParamsSchema = z.object({
  params: mediaIdParams,
  query: passthroughQuery,
  body: z.any(),
});

export const createListingSchema = z.object({
  params: z.object({}).passthrough(),
  query: passthroughQuery,
  body: z.object({
    partnerId: z.coerce.number().int().positive(),
    listingType: z.string().trim().min(1).max(30),
    slug: z.string().trim().min(1).max(180).optional(),
    isContactVisible: z.boolean().optional(),
    translations: z.array(translationSchema).min(1),
    location: locationSchema.optional(),
    categoryIds: positiveIdArray.optional(),
    amenityIds: positiveIdArray.optional(),
  }),
});

export const updateListingSchema = z.object({
  params: idParams,
  query: passthroughQuery,
  body: z
    .object({
      slug: z.string().trim().min(1).max(180).optional(),
      canonicalUrl: z.string().trim().url().max(500).optional(),
      ogImageMediaId: z.coerce.number().int().positive().optional(),
      isIndexable: z.boolean().optional(),
      isSitemapIncluded: z.boolean().optional(),
      isContactVisible: z.boolean().optional(),
      translations: z.array(translationSchema).min(1).optional(),
      location: locationSchema.optional(),
      categoryIds: positiveIdArray.optional(),
      amenityIds: positiveIdArray.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided.',
    }),
});

export const listListingsQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    partnerId: z.coerce.number().int().positive().optional(),
    listingType: z.string().trim().min(1).max(30).optional(),
    status: z.enum(LISTING_STATUSES).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const updateListingMediaSchema = z.object({
  params: mediaIdParams,
  query: passthroughQuery,
  body: z
    .object({
      position: z.coerce.number().int().min(0).optional(),
      isCover: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided.',
    }),
});
