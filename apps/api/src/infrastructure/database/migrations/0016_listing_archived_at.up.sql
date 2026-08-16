-- Phase 9 (Partner Dashboard): `listingStatusTransitions.js` has always
-- modeled PUBLISHED|UNPUBLISHED -> ARCHIVED as a legal transition, but no
-- endpoint ever reached it, so `listings` never needed a timestamp for it.
-- Adding `archived_at` mirrors the existing `published_at`/`unpublished_at`
-- columns (migration 0005) exactly, for the new `POST /listings/:id/archive`
-- endpoint that finally exercises this transition.

ALTER TABLE listings ADD COLUMN archived_at DATETIME(3) NULL AFTER unpublished_at;
