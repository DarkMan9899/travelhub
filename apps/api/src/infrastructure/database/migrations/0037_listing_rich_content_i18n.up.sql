-- 2026 stabilization audit: `listing_highlights`/`listing_itinerary_steps`/
-- `listing_included_items`/`listing_faqs` (migration 0026) were built with
-- no `language_id` column — genuinely single-language per listing. The
-- audit found the only 6 listings actually using them had this content
-- hand-authored in English only, which read as broken/mixed-language on
-- every other page of the same listing once viewed in Armenian or
-- Russian. Unlike `listing_translations` (one row per listing per
-- language) or `listing_amenity_translations` (one row per shared amenity
-- per language), these four tables are per-listing ORDERED LISTS of
-- free-text items authored directly by (or on behalf of) the partner —
-- there is no separate shared entity to hang a child translations table
-- off of, so the same shape `listing_translations` already uses (a
-- `language_id` column directly on the row) is applied here too: each
-- language gets its own full set of rows for a listing, at the same
-- `sort_order`s, exactly mirroring how a partner would author the same
-- ordered list twice, once per language.
--
-- Existing rows (this demo's own English-authored content, and any other
-- environment's) are backfilled to the platform's configured default
-- language (`languages.is_default = 1`) rather than a hardcoded id, since
-- the actual numeric id for a given language code is not guaranteed
-- stable across environments.
--
-- Each table's existing `idx_*_listing_id` index is what backs its
-- `listing_id` foreign key to `listings(id)` — MySQL refuses to drop an
-- index still covering a FK column, so the new composite index (which
-- also starts with `listing_id`, so it can serve the same FK) is added
-- FIRST, under a temporary name, then the old index is dropped, then the
-- new one is renamed into the old index's name. The new `language_id` FK
-- gets its own explicitly-named index (rather than relying on InnoDB's
-- auto-created one) so the down migration can drop it by a known name.

ALTER TABLE listing_highlights ADD COLUMN language_id BIGINT UNSIGNED NULL AFTER listing_id;
UPDATE listing_highlights SET language_id = (SELECT id FROM languages WHERE is_default = 1 LIMIT 1) WHERE language_id IS NULL;
ALTER TABLE listing_highlights MODIFY COLUMN language_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE listing_highlights ADD KEY idx_listing_highlights_language_id (language_id);
ALTER TABLE listing_highlights ADD CONSTRAINT fk_listing_highlights_language_id FOREIGN KEY (language_id) REFERENCES languages (id);
ALTER TABLE listing_highlights ADD KEY idx_listing_highlights_listing_id_new (listing_id, language_id, sort_order);
ALTER TABLE listing_highlights DROP INDEX idx_listing_highlights_listing_id;
ALTER TABLE listing_highlights RENAME INDEX idx_listing_highlights_listing_id_new TO idx_listing_highlights_listing_id;

ALTER TABLE listing_itinerary_steps ADD COLUMN language_id BIGINT UNSIGNED NULL AFTER listing_id;
UPDATE listing_itinerary_steps SET language_id = (SELECT id FROM languages WHERE is_default = 1 LIMIT 1) WHERE language_id IS NULL;
ALTER TABLE listing_itinerary_steps MODIFY COLUMN language_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE listing_itinerary_steps ADD KEY idx_listing_itinerary_steps_language_id (language_id);
ALTER TABLE listing_itinerary_steps ADD CONSTRAINT fk_listing_itinerary_steps_language_id FOREIGN KEY (language_id) REFERENCES languages (id);
ALTER TABLE listing_itinerary_steps ADD KEY idx_listing_itinerary_steps_listing_id_new (listing_id, language_id, sort_order);
ALTER TABLE listing_itinerary_steps DROP INDEX idx_listing_itinerary_steps_listing_id;
ALTER TABLE listing_itinerary_steps RENAME INDEX idx_listing_itinerary_steps_listing_id_new TO idx_listing_itinerary_steps_listing_id;

ALTER TABLE listing_included_items ADD COLUMN language_id BIGINT UNSIGNED NULL AFTER listing_id;
UPDATE listing_included_items SET language_id = (SELECT id FROM languages WHERE is_default = 1 LIMIT 1) WHERE language_id IS NULL;
ALTER TABLE listing_included_items MODIFY COLUMN language_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE listing_included_items ADD KEY idx_listing_included_items_language_id (language_id);
ALTER TABLE listing_included_items ADD CONSTRAINT fk_listing_included_items_language_id FOREIGN KEY (language_id) REFERENCES languages (id);
ALTER TABLE listing_included_items ADD KEY idx_listing_included_items_listing_id_new (listing_id, language_id, is_included, sort_order);
ALTER TABLE listing_included_items DROP INDEX idx_listing_included_items_listing_id;
ALTER TABLE listing_included_items RENAME INDEX idx_listing_included_items_listing_id_new TO idx_listing_included_items_listing_id;

ALTER TABLE listing_faqs ADD COLUMN language_id BIGINT UNSIGNED NULL AFTER listing_id;
UPDATE listing_faqs SET language_id = (SELECT id FROM languages WHERE is_default = 1 LIMIT 1) WHERE language_id IS NULL;
ALTER TABLE listing_faqs MODIFY COLUMN language_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE listing_faqs ADD KEY idx_listing_faqs_language_id (language_id);
ALTER TABLE listing_faqs ADD CONSTRAINT fk_listing_faqs_language_id FOREIGN KEY (language_id) REFERENCES languages (id);
ALTER TABLE listing_faqs ADD KEY idx_listing_faqs_listing_id_new (listing_id, language_id, sort_order);
ALTER TABLE listing_faqs DROP INDEX idx_listing_faqs_listing_id;
ALTER TABLE listing_faqs RENAME INDEX idx_listing_faqs_listing_id_new TO idx_listing_faqs_listing_id;
