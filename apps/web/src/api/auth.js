/**
 * Auth module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/auth/module.routes.js`
 * exactly — `register`, `login`, `refresh` are public; `logout`,
 * `logoutAll`, `me` rely on `client.js`'s interceptor already attaching
 * the access token.
 */

import apiClient from './client.js';

export function register({ email, password, firstName, lastName, phone }) {
  return apiClient
    .post('/auth/register', { email, password, firstName, lastName, phone })
    .then((response) => response.data);
}

export function login({ email, password }) {
  return apiClient
    .post('/auth/login', { email, password })
    .then((response) => response.data);
}

export function refresh() {
  return apiClient.post('/auth/refresh', {}).then((response) => response.data);
}

/** Always resolves the same way whether or not the email matched an account — see the API's own doc comment. */
export function requestPasswordReset({ email, locale }) {
  return apiClient
    .post('/auth/password-reset/request', { email, locale })
    .then((response) => response.data);
}

export function resetPassword({ token, newPassword }) {
  return apiClient
    .post('/auth/password-reset/confirm', { token, newPassword })
    .then((response) => response.data);
}

export function logout() {
  return apiClient.post('/auth/logout').then((response) => response.data);
}

export function logoutAll() {
  return apiClient.post('/auth/logout-all').then((response) => response.data);
}

/** `GET /auth/me` — `{ user, roles, permissions }`, hydrates AuthContext. */
export function me() {
  return apiClient.get('/auth/me').then((response) => response.data);
}
