import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelExternalReservation } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `DELETE /availability/external-reservations/:id`. */
export function useCancelExternalReservationMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }) => cancelExternalReservation(id),
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

export default useCancelExternalReservationMutation;
