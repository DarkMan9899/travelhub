/**
 * `useLoginMutation` — wraps `AuthContext.login` (itself `POST
 * /auth/login` + `GET /auth/me`, see `AuthProvider`) in React Query's
 * mutation shape purely for its `isPending`/`error` UX convenience —
 * `AuthContext` remains the one source of truth for session state
 * (FRONTEND_ARCHITECTURE.md §13.3), this hook never duplicates it.
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext.jsx';

export function useLoginMutation() {
  const { login } = useAuth();
  return useMutation({ mutationFn: login });
}

export default useLoginMutation;
