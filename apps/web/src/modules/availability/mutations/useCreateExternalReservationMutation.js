import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createExternalReservation } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `POST /availability/external-reservations` — phone/walk-in booking entry (spec §10). */
export function useCreateExternalReservationMutation(listingId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createExternalReservation(payload),
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

export default useCreateExternalReservationMutation;
