/**
 * CmsService — Stage 11.6 Admin Platform.
 *
 * Admin CRUD for `cms_pages`/`cms_page_translations`, plus the public
 * read (`getPublishedPage`) `docs/API_SPECIFICATION.md` §63 documents as
 * `GET /cms/pages/{slug}` — built correctly here, not yet called by any
 * frontend page (the six static public pages stay static this stage,
 * per the Phase 11 plan's scope decision).
 *
 * Every mutation requires `cms.manage` and is audit-logged; reads only
 * require the admin-area role already enforced by `module.routes.js`'s
 * `requireRole`, matching Stage 11.5's "view without the permission to
 * mutate" convention.
 */

import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../../errors/AppError.js';

const MANAGE_PERMISSION = 'cms.manage';

export class CmsService {
  #repository;

  #permissionResolver;

  #auditLogger;

  constructor({ repository, permissionResolver, auditLogger }) {
    this.#repository = repository;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
  }

  async #assertCanManage(principal) {
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      MANAGE_PERMISSION,
    );
    if (!granted) throw new AuthorizationError();
  }

  async #audit(principal, action, targetId, before, after) {
    await this.#auditLogger.record({
      actorId: principal.userId,
      action,
      targetType: 'cms_page',
      targetId,
      beforeSnapshot: before,
      afterSnapshot: after,
    });
  }

  /** Public: `GET /cms/pages/:slug` — falls back to the platform default language when the requested locale has no translation row for a published page. */
  async getPublishedPage(slug, languageCode) {
    const translation = await this.#repository.findPublishedTranslation(
      slug,
      languageCode,
    );
    if (!translation) throw new NotFoundError('Page not found.');
    return { slug, ...translation };
  }

  async listPages() {
    return this.#repository.listPages();
  }

  async getPageDetail(id) {
    const page = await this.#repository.findPageById(id);
    if (!page) throw new NotFoundError('Page not found.');
    const translations = await this.#repository.listTranslationsForPage(id);
    return { ...page, translations };
  }

  async createPage(principal, { slug, isPublished }) {
    await this.#assertCanManage(principal);
    const created = await this.#repository.createPage({ slug, isPublished });
    await this.#audit(principal, 'cms.page_created', created.id, null, created);
    return created;
  }

  async updatePage(principal, id, { slug, isPublished }) {
    await this.#assertCanManage(principal);
    const before = await this.#repository.findPageById(id);
    if (!before) throw new NotFoundError('Page not found.');
    const updated = await this.#repository.updatePage(id, {
      slug,
      isPublished,
    });
    await this.#audit(principal, 'cms.page_updated', id, before, updated);
    return updated;
  }

  async deletePage(principal, id) {
    await this.#assertCanManage(principal);
    const before = await this.#repository.findPageById(id);
    if (!before) throw new NotFoundError('Page not found.');
    await this.#repository.deletePage(id);
    await this.#audit(principal, 'cms.page_deleted', id, before, null);
  }

  async upsertTranslation(principal, pageId, languageCode, { title, content }) {
    await this.#assertCanManage(principal);
    const page = await this.#repository.findPageById(pageId);
    if (!page) throw new NotFoundError('Page not found.');
    const languageId =
      await this.#repository.findLanguageIdByCode(languageCode);
    if (!languageId) {
      throw new ValidationError(`Unknown language code "${languageCode}".`);
    }
    const before = await this.#repository.listTranslationsForPage(pageId);
    const translations = await this.#repository.upsertTranslation(
      pageId,
      languageId,
      { title, content },
    );
    await this.#audit(
      principal,
      'cms.page_translation_updated',
      pageId,
      before.find((t) => t.languageCode === languageCode) ?? null,
      translations.find((t) => t.languageCode === languageCode),
    );
    return translations;
  }
}

export default CmsService;
