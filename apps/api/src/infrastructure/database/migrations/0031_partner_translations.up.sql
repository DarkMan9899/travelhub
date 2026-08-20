-- P1.3 (Master Roadmap): localizes `partners.description`, the one
-- partner-profile field the roadmap explicitly calls out as needing
-- per-language content — mirrors `listing_translations`' exact shape
-- (migration 0005) rather than inventing a new localization pattern.
-- `display_name` stays a single global column, same reasoning
-- `listings.slug`/`partners.legal_name` aren't translated: a business's
-- own name is not something each locale re-authors.
--
-- The backfill assumes any existing free-text `description` was
-- authored in English (`en`) — the only locale this schema has ever
-- had a single-column description for — then the column is dropped in
-- the same migration so there is exactly one source of truth for a
-- partner's description going forward, never two.
CREATE TABLE IF NOT EXISTS partner_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  partner_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  description TEXT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_partner_translations_partner_id_language_id UNIQUE (partner_id, language_id),
  CONSTRAINT fk_partner_translations_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_partner_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO partner_translations (partner_id, language_id, description)
SELECT p.id, (SELECT id FROM languages WHERE code = 'en'), p.description
FROM partners p
WHERE p.description IS NOT NULL AND p.description != '';

ALTER TABLE partners DROP COLUMN description;
