-- Stage 11.6 (Admin Platform — CMS): the `cms` module's first real
-- tables — `docs/BACKEND_ARCHITECTURE.md` §28 already documented this
-- exact shape (`cms_pages`/`cms_page_translations`) before this stage
-- built anything. Page-level granularity (not per-block) — the six
-- static public pages this admin editor eventually feeds
-- (about/contact/faq/help/become-a-partner/blog, still static this
-- stage) are each one page's worth of content, not a set of composable
-- blocks, so a single title+content pair per locale is honest, not a
-- simplification. `is_published` gates the (not yet built) public read
-- endpoint from returning draft content.

CREATE TABLE IF NOT EXISTS cms_pages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(180) NOT NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_cms_pages_slug UNIQUE (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cms_page_translations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cms_page_id BIGINT UNSIGNED NOT NULL,
  language_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_cms_page_translations_page_id_language_id UNIQUE (cms_page_id, language_id),
  CONSTRAINT fk_cms_page_translations_page_id FOREIGN KEY (cms_page_id) REFERENCES cms_pages (id),
  CONSTRAINT fk_cms_page_translations_language_id FOREIGN KEY (language_id) REFERENCES languages (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
