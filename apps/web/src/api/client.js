/**
 * Axios instance — the ONLY place in the codebase that constructs a
 * base HTTP client (FRONTEND_ARCHITECTURE.md §10.1). Every module's
 * api/*.js file (added in future sprints, per module) imports this
 * instance rather than creating its own.
 *
 * Sprint 1 scope: base URL, default headers, and the locale/currency
 * request interceptor only. Auth token attachment (§10.2), refresh-token
 * rotation (§10.3), and idempotency-key handling (§10.5) are NOT wired
 * yet — there is no login flow to attach a token from, per this sprint's
 * explicit "do not implement authentication" scope. Their exact contract
 * is documented inline below so the sprint that adds them has no
 * ambiguity about where they plug in.
 */

import axios from 'axios';
import { DEFAULT_LOCALE } from '../translations/i18n.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Locale header (API_SPECIFICATION.md §15) — read from the URL's locale
// segment once routing exists; falls back to the platform default for
// any request issued before routing has resolved (e.g. this sprint's
// placeholder page, or a future non-route-driven background call).
apiClient.interceptors.request.use((requestConfig) => {
  const pathLocale = window.location.pathname.split('/')[1];
  const locale = ['hy', 'ru', 'en'].includes(pathLocale)
    ? pathLocale
    : DEFAULT_LOCALE;
  requestConfig.headers['Accept-Language'] = locale;
  return requestConfig;
});

// -----------------------------------------------------------------------
// TODO (future sprint — Authentication):
//   - Attach `Authorization: Bearer {access_token}` from an in-memory
//     token held by AuthContext (FRONTEND_ARCHITECTURE.md §10.2/§34.1)
//   - 401 response interceptor: single-flight refresh with concurrent-
//     request de-duplication (§10.3)
//   - Idempotency-Key generation for mutation hooks that require one
//     (§10.5/§22)
// None of this is implemented in Sprint 1 (no auth, no business logic).
// -----------------------------------------------------------------------

export default apiClient;
