import { useMutation } from '@tanstack/react-query';
import { testInventoryConnection } from '../../../api/availability.js';

/** `POST /inventory-connections/:id/test` — "Test connection" action, never mutates saved config. */
export function useTestInventoryConnectionMutation() {
  return useMutation({
    mutationFn: ({ id }) => testInventoryConnection(id),
  });
}

export default useTestInventoryConnectionMutation;
