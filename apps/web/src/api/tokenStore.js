/**
 * In-memory access-token store (FRONTEND_ARCHITECTURE.md §10.2/§34.1).
 *
 * The access token is held ONLY in this module-level variable — never
 * `localStorage`/`sessionStorage` (readable by any injected script,
 * i.e. XSS-exfiltratable) and never a cookie the frontend itself sets
 * (the refresh token already owns the httpOnly-cookie mechanism,
 * `apps/api/src/modules/auth/controllers/authController.js`). This is
 * the single source `api/client.js`'s request interceptor reads from,
 * and the single place `AuthProvider` (the only writer) updates on
 * login/refresh/logout — a plain module-level variable rather than a
 * React Context specifically so the axios interceptor (outside React)
 * can read it synchronously on every request without a hook.
 *
 * Lost on every full page reload by construction (no persistence) — that
 * is intentional, not a bug: `AuthProvider`'s bootstrap (`POST
 * /auth/refresh` via the httpOnly cookie, then `GET /auth/me`) is what
 * re-acquires it, exactly per §11.1.
 */

let accessToken = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function clearAccessToken() {
  accessToken = null;
}
