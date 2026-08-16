/**
 * CMS module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/cms/module.routes.js`.
 *
 * Stage 11.6 (Admin Platform): only the admin-facing endpoints are
 * wired up here. The public `GET /cms/pages/:slug` read exists on the
 * backend but has no frontend caller yet — the six static public pages
 * (`apps/web/src/modules/cms/`) stay static this stage, per the Phase 11
 * plan's own scope decision.
 */

import apiClient from './client.js';

/** `GET /cms/admin/pages` — every page's slug/publish state, no pagination (small, fixed-ish set). */
export function getAdminCmsPages() {
  return apiClient.get('/cms/admin/pages').then((response) => response.data);
}

/** `GET /cms/admin/pages/:id` — one page's settings plus every locale's translation. */
export function getAdminCmsPageDetail(id) {
  return apiClient
    .get(`/cms/admin/pages/${id}`)
    .then((response) => response.data);
}

/** `POST /cms/admin/pages` — `{ slug, isPublished? }`. Requires `cms.manage`. */
export function createCmsPage(payload) {
  return apiClient
    .post('/cms/admin/pages', payload)
    .then((response) => response.data);
}

/** `PATCH /cms/admin/pages/:id` — `{ slug, isPublished }`. Requires `cms.manage`. */
export function updateCmsPage(id, payload) {
  return apiClient
    .patch(`/cms/admin/pages/${id}`, payload)
    .then((response) => response.data);
}

/** `DELETE /cms/admin/pages/:id`. Requires `cms.manage`. */
export function deleteCmsPage(id) {
  return apiClient.delete(`/cms/admin/pages/${id}`);
}

/**
 * `PUT /cms/admin/pages/:id/translations/:languageCode` —
 * `{ title, content }`. Requires `cms.manage`. Returns every locale's
 * translation for the page (not just the one just written).
 */
export function upsertCmsTranslation(id, languageCode, payload) {
  return apiClient
    .put(`/cms/admin/pages/${id}/translations/${languageCode}`, payload)
    .then((response) => response.data);
}
