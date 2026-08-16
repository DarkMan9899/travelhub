/**
 * AuthContext — global client state (FRONTEND_ARCHITECTURE.md §13.3):
 * the authenticated user, roles, permissions, and (Phase 5) `partnerships`
 * (`[{ partner_id, slug, display_name, role }]`, empty for a non-partner).
 * Populated exclusively by `AuthProvider`; every other piece of code
 * (guards, `UserMenu`, `RequirePartner`) reads it through `useAuth()`,
 * never fetches its own copy.
 */

import { createContext, useContext } from 'react';

const AuthContext = createContext(null);

export default AuthContext;

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
