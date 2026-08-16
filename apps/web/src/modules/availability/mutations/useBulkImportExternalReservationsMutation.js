import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../api/client.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /availability/external-reservations/bulk-import` — the CSV wizard's confirm step (spec §21). */
export function useBulkImportExternalReservationsMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      apiClient
        .post('/availability/external-reservations/bulk-import', payload)
        .then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: availabilityKeys.externalReservations(listingId),
      });
      queryClient.invalidateQueries({
        queryKey: [...availabilityKeys.all, 'breakdown'],
      });
      queryClient.invalidateQueries({
        queryKey: [...availabilityKeys.all, 'ledger'],
      });
    },
  });
}

export default useBulkImportExternalReservationsMutation;
