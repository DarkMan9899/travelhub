/**
 * A minimal pub-sub so `client.js`'s response interceptor (framework-
 * agnostic, outside React — FRONTEND_ARCHITECTURE.md §10's `api/`
 * contract forbids it importing React hooks/Context) can signal
 * "the session is no longer valid" without importing `AuthProvider`
 * directly, which would create a circular dependency (`AuthProvider`
 * already depends on `api/auth.js`, which depends on `client.js`).
 * `AuthProvider` is this event's only subscriber — it clears
 * `AuthContext` state and lets `RequireAuth` redirect to login.
 */

const listeners = new Set();

export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSessionExpired() {
  listeners.forEach((listener) => listener());
}
