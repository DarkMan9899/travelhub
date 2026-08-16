/**
 * `useRegisterMutation` — wraps `AuthContext.register`, same rationale
 * as `useLoginMutation.js`.
 */

import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext.jsx';

export function useRegisterMutation() {
  const { register } = useAuth();
  return useMutation({ mutationFn: register });
}

export default useRegisterMutation;
