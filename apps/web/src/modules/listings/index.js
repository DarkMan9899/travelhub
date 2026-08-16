/**
 * `listings` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point another module may import from
 * (§6.3's cross-module rule).
 */

export { default as useListingQuery } from './queries/useListingQuery.js';
export { default as useListingMetadataQuery } from './queries/useListingMetadataQuery.js';
export { default as useListingBookableUnitsQuery } from './queries/useListingBookableUnitsQuery.js';
export { default as listingKeys } from './constants/queryKeys.js';
export { default as ListingDetailPageContent } from './components/ListingDetailPageContent/ListingDetailPageContent.jsx';
export { default as PartnerListingWizard } from './components/PartnerListingWizard/PartnerListingWizard.jsx';

// Phase 5 (Partner Listing Wizard) mutations.
export { default as useCreateListingMutation } from './mutations/useCreateListingMutation.js';
export { default as useUpdateListingMutation } from './mutations/useUpdateListingMutation.js';
export { default as usePublishListingMutation } from './mutations/usePublishListingMutation.js';
export { default as useUnpublishListingMutation } from './mutations/useUnpublishListingMutation.js';
export { default as useAttachListingMediaMutation } from './mutations/useAttachListingMediaMutation.js';
export { default as useUpdateListingMediaMutation } from './mutations/useUpdateListingMediaMutation.js';
export { default as useRemoveListingMediaMutation } from './mutations/useRemoveListingMediaMutation.js';

// Phase 9 (Partner Dashboard).
export { default as useMyListingsQuery } from './queries/useMyListingsQuery.js';
export { default as useArchiveListingMutation } from './mutations/useArchiveListingMutation.js';
export { default as useDeleteListingMutation } from './mutations/useDeleteListingMutation.js';
export { default as useListingCalendarQuery } from './queries/useListingCalendarQuery.js';
export { default as useSetAvailabilityMutation } from './mutations/useSetAvailabilityMutation.js';
export { default as ListingStatusBadge } from './components/ListingStatusBadge/ListingStatusBadge.jsx';
export { LISTING_STATUS_KEYS } from './constants/listingStatuses.js';
