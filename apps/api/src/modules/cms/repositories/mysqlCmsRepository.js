/**
 * MySQL-backed CMS repository — Stage 11.6 Admin Platform.
 *
 * `cms_pages` (migration 0018) is page-level content (title + body per
 * locale via `cms_page_translations`), matching
 * `docs/BACKEND_ARCHITECTURE.md` §28's pre-existing spec. Every write
 * goes through `#run`, mapping a raw MySQL driver error (duplicate slug,
 * or a delete blocked by an FK) to the platform's Exception Hierarchy —
 * the same convention `mysqlMarketplaceConfigRepository.js` established
 * in Stage 11.5.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';

function toPageDomain(row) {
  return {
    id: row.id,
    slug: row.slug,
    isPublished: Boolean(row.is_published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toTranslationDomain(row) {
  return {
    languageId: row.language_id,
    languageCode: row.language_code,
    title: row.title,
    content: row.content,
  };
}

export class MySqlCmsRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  async #run(sql, params) {
    try {
      return await this.#pool.query(sql, params);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async listPages() {
    const [rows] = await this.#run(
      'SELECT id, slug, is_published, created_at, updated_at FROM cms_pages ORDER BY slug ASC',
    );
    return rows.map(toPageDomain);
  }

  async findPageById(id) {
    const [rows] = await this.#run(
      'SELECT id, slug, is_published, created_at, updated_at FROM cms_pages WHERE id = ?',
      [id],
    );
    return rows[0] ? toPageDomain(rows[0]) : null;
  }

  async findPageBySlug(slug) {
    const [rows] = await this.#run(
      'SELECT id, slug, is_published, created_at, updated_at FROM cms_pages WHERE slug = ?',
      [slug],
    );
    return rows[0] ? toPageDomain(rows[0]) : null;
  }

  async listTranslationsForPage(pageId) {
    const [rows] = await this.#run(
      `SELECT t.language_id, l.code AS language_code, t.title, t.content
       FROM cms_page_translations t
       JOIN languages l ON l.id = t.language_id
       WHERE t.cms_page_id = ?
       ORDER BY l.code ASC`,
      [pageId],
    );
    return rows.map(toTranslationDomain);
  }

  /** Public read: a published page's translation for one locale, falling back to the platform default language when the requested locale has no row. */
  async findPublishedTranslation(slug, languageCode) {
    const [rows] = await this.#run(
      `SELECT p.id AS page_id, t.language_id, l.code AS language_code, t.title, t.content
       FROM cms_pages p
       JOIN cms_page_translations t ON t.cms_page_id = p.id
       JOIN languages l ON l.id = t.language_id
       WHERE p.slug = ? AND p.is_published = 1
         AND l.code = ?
       LIMIT 1`,
      [slug, languageCode],
    );
    if (rows[0]) return toTranslationDomain(rows[0]);

    const [fallbackRows] = await this.#run(
      `SELECT p.id AS page_id, t.language_id, l.code AS language_code, t.title, t.content
       FROM cms_pages p
       JOIN cms_page_translations t ON t.cms_page_id = p.id
       JOIN languages l ON l.id = t.language_id
       WHERE p.slug = ? AND p.is_published = 1 AND l.is_default = 1
       LIMIT 1`,
      [slug],
    );
    return fallbackRows[0] ? toTranslationDomain(fallbackRows[0]) : null;
  }

  async createPage({ slug, isPublished }) {
    const [result] = await this.#run(
      'INSERT INTO cms_pages (slug, is_published) VALUES (?, ?)',
      [slug, isPublished ? 1 : 0],
    );
    return this.findPageById(result.insertId);
  }

  async updatePage(id, { slug, isPublished }) {
    await this.#run(
      'UPDATE cms_pages SET slug = ?, is_published = ? WHERE id = ?',
      [slug, isPublished ? 1 : 0, id],
    );
    return this.findPageById(id);
  }

  async deletePage(id) {
    await this.#run('DELETE FROM cms_page_translations WHERE cms_page_id = ?', [
      id,
    ]);
    await this.#run('DELETE FROM cms_pages WHERE id = ?', [id]);
  }

  async findLanguageIdByCode(code) {
    const [rows] = await this.#run('SELECT id FROM languages WHERE code = ?', [
      code,
    ]);
    return rows[0]?.id ?? null;
  }

  async upsertTranslation(pageId, languageId, { title, content }) {
    await this.#run(
      `INSERT INTO cms_page_translations (cms_page_id, language_id, title, content)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE title = VALUES(title), content = VALUES(content)`,
      [pageId, languageId, title, content],
    );
    return this.listTranslationsForPage(pageId);
  }
}

export default MySqlCmsRepository;
