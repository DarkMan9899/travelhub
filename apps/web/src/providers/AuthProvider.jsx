/**
 * AuthProvider — session bootstrap and mutation orchestration
 * (FRONTEND_ARCHITECTURE.md §11).
 *
 * Bootstrap (§11.1): on mount, attempts `POST /auth/refresh` (using
 * nothing but the httpOnly cookie the browser already carries — no
 * request body, no stored token to read) and, if that succeeds,
 * `GET /auth/me` to hydrate `AuthContext`. `isBootstrapping` is exposed
 * specifically so `RequireAuth` (Ch. 12) can tell "still checking" apart
 * from "definitely logged out" and never briefly flashes a redirect.
 *
 * `login`/`register` both immediately follow up with `GET /auth/me`
 * rather than trusting `roles`/`permissions` from the auth response —
 * `toAuthResponseDto` (apps/api's auth DTO) doesn't return them, only
 * `toPrincipalDto` does, so this keeps exactly one code path that
 * populates `AuthContext`'s full shape.
 *
 * Phase 5: `hydrateFromMe` also fetches `GET /partners/mine` (in
 * parallel with `GET /auth/me`) to populate `partnerships` — every user
 * gets a real answer (an empty array for a non-partner, per that
 * endpoint's own contract), not just partners. Calls `api/partners.js`
 * directly rather than the `partner` module's `useMyPartnershipsQuery`
 * hook: FRONTEND_ARCHITECTURE.md §6.3 requires foundational providers
 * like this one to depend on nothing but shared `api/`/`contexts/`, never
 * a feature module (`partner` is explicitly a one-directional
 * composition module — nothing may depend on it, not the reverse).
 * `RequirePartner` and any other consumer read `partnerships` from this
 * context, never fetching their own copy.
 *
 * Phase 8 (Auth / User Dashboard): `refreshUser` exposes `hydrateFromMe`
 * itself, so a profile-edit/avatar-upload/password-change mutation can
 * re-sync `AuthContext.user` after a successful write — the same
 * `GET /auth/me` (+`GET /partners/mine`) round trip `login`/`register`
 * already perform, not a new endpoint.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import AuthContext from '../contexts/AuthContext.jsx';
import * as authApi from '../api/auth.js';
import * as partnersApi from '../api/partners.js';
import { setAccessToken, clearAccessToken } from '../api/tokenStore.js';
import { onSessionExpired } from '../api/authEvents.js';

const EMPTY_SESSION = {
  user: null,
  roles: [],
  permissions: [],
  partnerships: [],
};

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(EMPTY_SESSION);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const clearSession = useCallback(() => {
    clearAccessToken();
    setSession(EMPTY_SESSION);
  }, []);

  const hydrateFromMe = useCallback(async () => {
    const [{ data }, { data: partnerships }] = await Promise.all([
      authApi.me(),
      partnersApi.getMyPartnerships(),
    ]);
    setSession({
      user: data.user,
      roles: data.roles,
      permissions: data.permissions,
      partnerships,
    });
    // Phase 10: `login`/`register` return this so a caller (e.g.
    // `LoginForm`'s role-aware post-login redirect) can read the freshly
    // fetched `partnerships`/`roles` directly from the resolved promise,
    // instead of reading `useAuth()` from a stale render-time closure —
    // this component's own state won't have re-rendered with the new
    // value by the time an `await`ed caller resumes. Phase 11 adds
    // `roles` alongside the existing `partnerships` for the Admin-area
    // redirect branch.
    return { partnerships, roles: data.roles };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const { data } = await authApi.refresh();
        setAccessToken(data.access_token);
        if (!cancelled) await hydrateFromMe();
      } catch {
        if (!cancelled) clearSession();
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    bootstrap();
    return () => {
      cancelled = true;
    };
    // Deliberately once-on-mount only — a session refresh mid-session is
    // client.js's 401-interceptor concern (§10.3), not this effect's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §11.4's cross-tab sync starting point: client.js's response
  // interceptor emits this when a refresh attempt (triggered by any
  // request, anywhere) definitively fails — AuthProvider is its one
  // subscriber, clearing state so RequireAuth redirects.
  useEffect(() => onSessionExpired(clearSession), [clearSession]);

  const login = useCallback(
    async ({ email, password }) => {
      const { data } = await authApi.login({ email, password });
      setAccessToken(data.access_token);
      return hydrateFromMe();
    },
    [hydrateFromMe],
  );

  const register = useCallback(
    async (fields) => {
      const { data } = await authApi.register(fields);
      setAccessToken(data.access_token);
      await hydrateFromMe();
    },
    [hydrateFromMe],
  );

  // Best-effort: the local session is cleared unconditionally — a failed
  // `POST /auth/logout` (e.g. the network drops) shouldn't leave the UI
  // stuck "logged in" when the user has already asked to leave, and
  // isn't a failure the caller (`UserMenu`) needs to react to. Swallowed
  // here, not just try/finally'd, specifically so it never surfaces as
  // an unhandled rejection at the call site.
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Intentionally ignored — see comment above.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } catch {
      // Intentionally ignored — see `logout`'s comment above.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user: session.user,
      roles: session.roles,
      permissions: session.permissions,
      partnerships: session.partnerships,
      isAuthenticated: Boolean(session.user),
      isBootstrapping,
      login,
      register,
      logout,
      logoutAll,
      refreshUser: hydrateFromMe,
    }),
    [
      session,
      isBootstrapping,
      login,
      register,
      logout,
      logoutAll,
      hydrateFromMe,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
