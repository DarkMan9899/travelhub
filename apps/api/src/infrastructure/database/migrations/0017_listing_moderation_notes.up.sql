-- Stage 11.3 (Admin Platform — Listing Moderation): `listing.moderate`
-- (seeded since Sprint 5) has been dormant — no endpoint ever wrote
-- `listings.moderation_status_id`. Adding a free-text `moderation_notes`
-- column lets a moderator record why a listing was rejected/flagged,
-- surfaced back to the partner — mirrors no existing column exactly
-- (partners/media/reviews moderation shipped without one), but follows
-- migration 0016's single-`ALTER TABLE ADD COLUMN` shape.

ALTER TABLE listings ADD COLUMN moderation_notes TEXT NULL AFTER moderation_status_id;
