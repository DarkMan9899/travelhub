/**
 * CMS module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/cms/module.routes.js`.
 *
 * P1.6 (Master Roadmap): `getCmsPage` is the public read the six static
 * pages (`apps/web/src/modules/cms/`) now actually call, closing the
 * gap the Stage 11.6 admin editor's own comment flagged ("this editor
 * is real, but its output isn't live anywhere yet").
 */

import apiClient from './client.js';

/**
 * `GET /cms/pages/:slug?locale=` — public, no auth. 404s for an unknown
 * or unpublished slug (the six pages' own fallback-to-static-i18n
 * handles that — see e.g. `AboutPageContent.jsx`).
 */
export function getCmsPage(slug, locale) {
  return apiClient
    .get(`/cms/pages/${slug}`, { params: { locale } })
    .then((response) => response.data);
}

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
