/**
 * Search module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md §10) —
 * structural/format validation only. `status`/`sort` are validated
 * against the real, reused domain enums (`LISTING_STATUSES`/`SORT_KEYS`)
 * rather than re-declared string literals, so a future new status/sort
 * option can't silently drift out of sync between the two files.
 * Business-rule validation (visibility narrowing, locale resolution)
 * lives in `SearchService`, never here.
 */

import { z } from 'zod';
import { LISTING_STATUSES } from '../../../core/domain/listingStatusTransitions.js';
import {
  SORT_KEYS,
  DEFAULT_SORT_KEY,
} from '../../../core/domain/sortOptions.js';

const passthroughParams = z.object({}).passthrough();

const paginationShape = {
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
};

export const searchListingsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    keyword: z.string().trim().max(200).optional(),
    categoryId: z.coerce.number().int().positive().optional(),
    listingType: z.string().trim().min(1).max(30).optional(),
    cityId: z.coerce.number().int().positive().optional(),
    countryId: z.coerce.number().int().positive().optional(),
    partnerId: z.coerce.number().int().positive().optional(),
    status: z.enum(LISTING_STATUSES).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
    sort: z.enum(SORT_KEYS).default(DEFAULT_SORT_KEY),
    ...paginationShape,
  }),
  body: z.any(),
});

export const searchCategoriesQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    locale: z.string().trim().min(2).max(10).optional(),
  }),
  body: z.any(),
});

export const searchSuggestionsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    q: z.string().trim().max(200).optional(),
    locale: z.string().trim().min(2).max(10).optional(),
  }),
  body: z.any(),
});
