/**
 * Partners module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/partners/
 * module.routes.js`. Phase 5 shipped `GET /mine` (authenticated, "which
 * partner orgs am I an employee of"). Phase 10 (redesign) adds the
 * module's first public reads — `GET /` (Companies directory) and
 * `GET /:slug` (Company profile) — no org creation/editing exists on
 * either phase's backend.
 */

import apiClient from './client.js';

/**
 * `GET /partners/mine` — the authenticated user's partner memberships,
 * `[{ partner_id, slug, display_name, role }]` (`partnerDto.js`'s
 * `toPartnershipResponse`). Requires authentication; there is no
 * meaningful anonymous answer.
 */
export function getMyPartnerships() {
  return apiClient.get('/partners/mine').then((response) => response.data);
}

/**
 * `GET /partners` — public Companies directory, cursor-paginated
 * (`{ id, slug, display_name, description, logo_url, cover_url,
 * listing_count, is_verified }[]` — `partnerDto.js`'s
 * `toPartnerSummaryResponse`). No auth required.
 * @param {{ cursor?: string, limit?: number }} params
 */
export function getPartners(params) {
  return apiClient
    .get('/partners', { params })
    .then((response) => response.data);
}

/**
 * `GET /partners/:slug` — public Company profile (extends the summary
 * shape above with `email, phone, website, social_links` —
 * `partnerDto.js`'s `toPartnerDetailResponse`). No auth required;
 * resolves to a 404 for an unknown/unapproved slug.
 * @param {string} slug
 */
export function getPartnerBySlug(slug) {
  return apiClient
    .get(`/partners/${encodeURIComponent(slug)}`)
    .then((response) => response.data);
}

/**
 * `GET /partners/by-user/:userId` — Phase 11 Admin Platform: another
 * user's partner memberships, for the User Management detail page.
 * Requires `user.view`.
 */
export function getPartnerMembershipsForUser(userId) {
  return apiClient
    .get(`/partners/by-user/${userId}`)
    .then((response) => response.data);
}

/**
 * Stage 11.2 (Partner Management) — admin-scoped endpoints, all under
 * `/partners/admin/*`. Requires `partner.verify` or `partner.moderate`
 * for reads, the specific one for each write (see
 * `module.routes.js`/`partnerService.js`).
 */

/**
 * `GET /partners/admin` — every partner regardless of status,
 * cursor-paginated.
 * @param {{ keyword?: string, verificationStatus?: string, moderationStatus?: string, cursor?: string, limit?: number }} params
 */
export function getAdminPartners(params) {
  return apiClient
    .get('/partners/admin', { params })
    .then((response) => response.data);
}

/** `GET /partners/admin/:id` — admin-only detail, with owner + listing stats. */
export function getAdminPartnerDetail(id) {
  return apiClient
    .get(`/partners/admin/${id}`)
    .then((response) => response.data);
}

/**
 * `PATCH /partners/admin/:id/verification-status` — approve/reject/reset
 * a partner's onboarding decision. Requires `partner.verify`.
 */
export function updatePartnerVerificationStatus(id, status) {
  return apiClient
    .patch(`/partners/admin/${id}/verification-status`, { status })
    .then((response) => response.data);
}

/**
 * `PATCH /partners/admin/:id/moderation-status` — suspend (FLAGGED) or
 * restore (APPROVED) an already-verified partner's public visibility.
 * Requires `partner.moderate`.
 */
export function updatePartnerModerationStatus(id, status) {
  return apiClient
    .patch(`/partners/admin/${id}/moderation-status`, { status })
    .then((response) => response.data);
}
