/**
 * Axios instance — the ONLY place in the codebase that constructs a
 * base HTTP client (FRONTEND_ARCHITECTURE.md §10.1). Every module's
 * api/*.js file imports this instance rather than creating its own.
 *
 * Application Foundation phase: adds the Authorization header (§10.2),
 * refresh-token rotation with concurrent-request de-duplication (§10.3),
 * and API error normalization (§10.8) that Sprint 1 explicitly deferred.
 * Idempotency-Key generation (§10.5) is still deferred — it belongs to
 * individual mutation hooks once a mutation that needs one exists
 * (booking holds, payments — none of which are built yet).
 */

import axios from 'axios';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '../translations/i18n.js';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
} from './tokenStore.js';
import { emitSessionExpired } from './authEvents.js';
import { normalizeError } from './ApiError.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Required so the browser sends/receives the httpOnly refresh-token
  // cookie apps/api's authController sets (`credentials: true` is also
  // set on the backend's CORS config specifically for this — cookies are
  // never sent cross-origin without both sides opting in).
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    // apps/api's authController only sets the refresh-token cookie for
    // requests carrying this header — see its own file header for why.
    'X-Client': 'web',
  },
});

// Locale header (API_SPECIFICATION.md §15) — read from the URL's locale
// segment, falling back to the platform default for any request issued
// before routing has resolved.
apiClient.interceptors.request.use((requestConfig) => {
  const pathLocale = window.location.pathname.split('/')[1];
  const locale = SUPPORTED_LOCALES.includes(pathLocale)
    ? pathLocale
    : DEFAULT_LOCALE;
  requestConfig.headers['Accept-Language'] = locale;

  // §10.2: attached to every request that has one — public endpoints
  // simply ignore an Authorization header they don't require.
  const accessToken = getAccessToken();
  if (accessToken) {
    requestConfig.headers.Authorization = `Bearer ${accessToken}`;
  }

  return requestConfig;
});

// §10.3: single in-flight refresh shared by every request that hits a
// 401 at the same time, so a page that fires several queries right as
// the access token expires triggers exactly one `POST /auth/refresh`,
// not one per failed request (which would race against the refresh
// token's single-use rotation).
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true, headers: { 'X-Client': 'web' } },
      )
      .then((response) => {
        const token = response.data.data.access_token;
        setAccessToken(token);
        return token;
      })
      .catch((error) => {
        clearAccessToken();
        emitSessionExpired();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const isAuthEndpoint = originalRequest?.url?.startsWith('/auth/');

    // §10.3: retried at most once — a request that fails 401 again
    // immediately after a successful refresh is a genuine auth failure,
    // never looped.
    if (
      status === 401 &&
      code === 'UNAUTHENTICATED' &&
      !isAuthEndpoint &&
      !originalRequest.retried
    ) {
      originalRequest.retried = true;
      try {
        const token = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return await apiClient(originalRequest);
      } catch {
        return Promise.reject(normalizeError(error));
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

export default apiClient;
