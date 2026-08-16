/**
 * Favorites module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10).
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

export const addFavoriteSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    listingId: z.coerce.number().int().positive(),
  }),
});

export const listingIdParamsSchema = z.object({
  params: z.object({ listingId: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

export const listFavoritesQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});
