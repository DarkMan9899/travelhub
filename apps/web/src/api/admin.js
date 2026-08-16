/**
 * Admin module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/admin/module.routes.js`.
 * Every route in the backend module requires one of the four
 * admin-area roles (ADMIN/SUPER_ADMIN/MODERATOR/SUPPORT) — enforced
 * server-side, not by this file.
 */

import apiClient from './client.js';

/**
 * `GET /admin/dashboard` — marketplace metrics: counts, pending actions,
 * booking value by currency, a 14-day bookings series, and recent
 * audit-log activity (`adminDto.js`'s `toDashboardResponse`).
 */
export function getDashboard() {
  return apiClient.get('/admin/dashboard').then((response) => response.data);
}

/**
 * Stage 11.1 (User Management) — these three live on `/users`, not
 * `/admin`, mirroring `apps/api/src/modules/users/module.routes.js`
 * exactly (the admin module owns cross-cutting composition, not
 * per-entity CRUD that already has a home).
 *
 * `GET /users` — admin-only, cursor-paginated. Requires `user.list`.
 * @param {{ keyword?: string, status?: string, cursor?: string, limit?: number }} params
 */
export function getUsers(params) {
  return apiClient.get('/users', { params }).then((response) => response.data);
}

/** `GET /users/:id` — admin-only detail. Requires `user.view`. */
export function getUserDetail(id) {
  return apiClient.get(`/users/${id}`).then((response) => response.data);
}

/**
 * `PATCH /users/:id/status` — suspend/activate/ban. Requires
 * `user.suspend`. `status` must be one of ACTIVE/SUSPENDED/BANNED.
 */
export function updateUserStatus(id, status) {
  return apiClient
    .patch(`/users/${id}/status`, { status })
    .then((response) => response.data);
}

/**
 * Stage 11.5 (Marketplace Configuration) — admin CRUD for the platform's
 * simple lookup entities. Every write requires `marketplace.configure`;
 * every read only requires an admin-area role (enforced server-side, not
 * here). Mirrors `apps/api/src/modules/admin/module.routes.js`'s
 * `/config/*` routes exactly.
 */

export function getCategories() {
  return apiClient
    .get('/admin/config/categories')
    .then((response) => response.data);
}
export function createCategory(payload) {
  return apiClient
    .post('/admin/config/categories', payload)
    .then((response) => response.data);
}
export function updateCategory(id, payload) {
  return apiClient
    .patch(`/admin/config/categories/${id}`, payload)
    .then((response) => response.data);
}
export function deleteCategory(id) {
  return apiClient.delete(`/admin/config/categories/${id}`);
}

export function getAmenityGroups() {
  return apiClient
    .get('/admin/config/amenity-groups')
    .then((response) => response.data);
}
export function getAmenities() {
  return apiClient
    .get('/admin/config/amenities')
    .then((response) => response.data);
}
export function createAmenity(payload) {
  return apiClient
    .post('/admin/config/amenities', payload)
    .then((response) => response.data);
}
export function updateAmenity(id, payload) {
  return apiClient
    .patch(`/admin/config/amenities/${id}`, payload)
    .then((response) => response.data);
}
export function deleteAmenity(id) {
  return apiClient.delete(`/admin/config/amenities/${id}`);
}

export function getPricingModels() {
  return apiClient
    .get('/admin/config/pricing-models')
    .then((response) => response.data);
}
export function createPricingModel(payload) {
  return apiClient
    .post('/admin/config/pricing-models', payload)
    .then((response) => response.data);
}
export function updatePricingModel(id, payload) {
  return apiClient
    .patch(`/admin/config/pricing-models/${id}`, payload)
    .then((response) => response.data);
}
export function deletePricingModel(id) {
  return apiClient.delete(`/admin/config/pricing-models/${id}`);
}

export function getCountries() {
  return apiClient
    .get('/admin/config/countries')
    .then((response) => response.data);
}
export function createCountry(payload) {
  return apiClient
    .post('/admin/config/countries', payload)
    .then((response) => response.data);
}
export function updateCountry(id, payload) {
  return apiClient
    .patch(`/admin/config/countries/${id}`, payload)
    .then((response) => response.data);
}
export function deleteCountry(id) {
  return apiClient.delete(`/admin/config/countries/${id}`);
}

export function getRegions(params) {
  return apiClient
    .get('/admin/config/regions', { params })
    .then((response) => response.data);
}
export function createRegion(payload) {
  return apiClient
    .post('/admin/config/regions', payload)
    .then((response) => response.data);
}
export function updateRegion(id, payload) {
  return apiClient
    .patch(`/admin/config/regions/${id}`, payload)
    .then((response) => response.data);
}
export function deleteRegion(id) {
  return apiClient.delete(`/admin/config/regions/${id}`);
}

export function getCities(params) {
  return apiClient
    .get('/admin/config/cities', { params })
    .then((response) => response.data);
}
export function createCity(payload) {
  return apiClient
    .post('/admin/config/cities', payload)
    .then((response) => response.data);
}
export function updateCity(id, payload) {
  return apiClient
    .patch(`/admin/config/cities/${id}`, payload)
    .then((response) => response.data);
}
export function deleteCity(id) {
  return apiClient.delete(`/admin/config/cities/${id}`);
}

/**
 * Stage 11.7 (Audit Logs) — view-only, cursor-paginated. Requires
 * `audit.view` (SUPER_ADMIN/ADMIN/SUPPORT — not MODERATOR).
 * @param {{ actorId?: number, targetType?: string, targetId?: number, action?: string, dateFrom?: string, dateTo?: string, cursor?: string, limit?: number }} params
 */
export function getAuditLogs(params) {
  return apiClient
    .get('/admin/audit-logs', { params })
    .then((response) => response.data);
}

/**
 * Stage 11.8 (System Health) — no filters, no pagination: DB/Redis/queue
 * probes + environment/version, open to every admin-area role (no extra
 * permission, same as `getDashboard`).
 */
export function getSystemHealth() {
  return apiClient
    .get('/admin/system-health')
    .then((response) => response.data);
}

/**
 * Stage 11.9 (Settings) — admin CRUD for the generic key/JSON-value
 * `system_settings` store and named boolean `feature_flags`. Every read
 * only requires an admin-area role; every write requires
 * `settings.manage`. Mirrors `apps/api/src/modules/admin/module.routes.js`'s
 * `/settings` and `/feature-flags` routes exactly.
 */

export function getSettings() {
  return apiClient.get('/admin/settings').then((response) => response.data);
}
export function createSetting(payload) {
  return apiClient
    .post('/admin/settings', payload)
    .then((response) => response.data);
}
export function updateSetting(id, payload) {
  return apiClient
    .patch(`/admin/settings/${id}`, payload)
    .then((response) => response.data);
}
export function deleteSetting(id) {
  return apiClient.delete(`/admin/settings/${id}`);
}

export function getFeatureFlags() {
  return apiClient
    .get('/admin/feature-flags')
    .then((response) => response.data);
}
export function createFeatureFlag(payload) {
  return apiClient
    .post('/admin/feature-flags', payload)
    .then((response) => response.data);
}
export function updateFeatureFlag(id, payload) {
  return apiClient
    .patch(`/admin/feature-flags/${id}`, payload)
    .then((response) => response.data);
}
export function deleteFeatureFlag(id) {
  return apiClient.delete(`/admin/feature-flags/${id}`);
}

/**
 * Phase 14.10 cleanup — this lives on `/notifications`, not `/admin`,
 * same "the owning module keeps the route, admin only composes the UI"
 * rule the Users section above documents. Backend endpoint and the
 * frontend's `admin.announcement` rendering (`notificationCopy.js`) were
 * both already real; this was the one missing piece — an authoring call.
 * Requires the `ADMIN`/`SUPER_ADMIN` role specifically (checked in
 * `notificationService.createAnnouncement`, not a permission key like
 * every other admin write here).
 * @param {{ audience: {type: 'ALL'} | {type: 'ROLE', roles: string[]}, priorityCode?: string, payload: {title: string, body?: string} }} input
 */
export function createAnnouncement(input) {
  return apiClient
    .post('/notifications/announcements', input)
    .then((response) => response.data);
}
