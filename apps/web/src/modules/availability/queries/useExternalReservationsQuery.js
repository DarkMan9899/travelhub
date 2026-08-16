import { useQuery } from '@tanstack/react-query';
import { listExternalReservations } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /availability/external-reservations?listingId=` — phone/walk-in/OTA-recorded occupancy. */
export function useExternalReservationsQuery(listingId) {
  return useQuery({
    queryKey: availabilityKeys.externalReservations(listingId),
    queryFn: () => listExternalReservations(listingId).then((res) => res.data),
    enabled: Boolean(listingId),
    staleTime: 15_000,
  });
}

export default useExternalReservationsQuery;
