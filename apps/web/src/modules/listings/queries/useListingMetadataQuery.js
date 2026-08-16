/**
 * `useListingMetadataQuery` — wraps `GET /listings/metadata?categoryId=X`
 * (FRONTEND_ARCHITECTURE.md §14). This is the ONLY source of the
 * category-scoped attributes/amenity groups/pricing models/policies
 * `DynamicAttributesStep`, `AmenitiesStep`, `PricingStep`, and
 * `PoliciesStep` all render from via `MetadataFieldRenderer` — no
 * attribute, amenity, pricing model, or policy is ever hardcoded in a
 * wizard step.
 *
 * `categoryId` is part of the query key, so switching category in
 * `CategoryStep` transparently refetches — the same "form automatically
 * adapts" mechanism `useSearchFilterDefinitionsQuery` already
 * established for search. `staleTime: 5 minutes` matches that hook's
 * cache class (reference-shaped metadata, not search results).
 *
 * `locale` must be passed explicitly (the caller reads it from the URL via
 * `useParams()`) — the backend resolves it into localized amenity names
 * (`listing_amenity_translations`) and there is no other channel it picks
 * up the current UI language from, mirroring `useListingCategoriesQuery`.
 */

import { useQuery } from '@tanstack/react-query';
import { getListingMetadata } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useListingMetadataQuery(categoryId, locale) {
  return useQuery({
    queryKey: listingKeys.metadata(categoryId, locale),
    queryFn: async () => {
      const { data } = await getListingMetadata(categoryId, locale);
      return data;
    },
    enabled: Boolean(categoryId),
    staleTime: 5 * 60 * 1000,
  });
}

export default useListingMetadataQuery;
