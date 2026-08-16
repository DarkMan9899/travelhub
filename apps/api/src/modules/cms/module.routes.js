/**
 * CMS module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic).
 *
 * `GET /cms/pages/:slug` is public (no auth) — the first real read path
 * onto `cms_pages`/`cms_page_translations`, matching
 * `docs/API_SPECIFICATION.md` §63. Not yet called by any frontend page
 * this stage (the six static public pages stay static, per the Phase 11
 * plan's scope decision) — built correctly so a later stage can wire it
 * up without a second pass on the backend.
 *
 * Every `/admin/pages*` route requires one of the four admin-area roles;
 * every write additionally requires `cms.manage` (ADMIN/SUPER_ADMIN
 * only, per `004_roles_and_permissions.js`) — same split Stage 11.5
 * established for `/admin/config/*`.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  publicPageParamsSchema,
  idParamsSchema,
  createPageSchema,
  updatePageSchema,
  upsertTranslationSchema,
} from './validators/cmsValidators.js';

const ADMIN_AREA_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MODERATOR', 'SUPPORT'];

export default function createCmsRoutes({ cmsController, guards }) {
  const router = Router();
  const { requireAuth, requireRole, requirePermission } = guards;

  router.get(
    '/pages/:slug',
    validate(publicPageParamsSchema),
    cmsController.getPublicPage,
  );

  const adminRouter = Router();
  adminRouter.use(requireAuth, requireRole(...ADMIN_AREA_ROLES));
  const manage = requirePermission('cms.manage');

  adminRouter.get('/pages', cmsController.listPages);
  adminRouter.post(
    '/pages',
    manage,
    validate(createPageSchema),
    cmsController.createPage,
  );
  adminRouter.get(
    '/pages/:id',
    validate(idParamsSchema),
    cmsController.getPageDetail,
  );
  adminRouter.patch(
    '/pages/:id',
    manage,
    validate(updatePageSchema),
    cmsController.updatePage,
  );
  adminRouter.delete(
    '/pages/:id',
    manage,
    validate(idParamsSchema),
    cmsController.deletePage,
  );
  adminRouter.put(
    '/pages/:id/translations/:languageCode',
    manage,
    validate(upsertTranslationSchema),
    cmsController.upsertTranslation,
  );

  router.use('/admin', adminRouter);

  return router;
}
