/**
 * `useLogoutMutation` — wraps `AuthContext.logout`. Consumed by
 * `UserMenu` (`apps/web/src/components/UserMenu`).
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext.jsx';

export function useLogoutMutation() {
  const { logout } = useAuth();
  return useMutation({ mutationFn: logout });
}

export default useLogoutMutation;
