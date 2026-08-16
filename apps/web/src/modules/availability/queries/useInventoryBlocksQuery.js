import { useQuery } from '@tanstack/react-query';
import { listInventoryBlocks } from '../../../api/availability.js';
import availabilityKeys from '../constants/queryKeys.js';

/** `GET /availability/blocks?listingId=` — Phase 17 manual blocks for a listing's units. */
export function useInventoryBlocksQuery(listingId) {
  return useQuery({
    queryKey: availabilityKeys.blocks(listingId),
    queryFn: () => listInventoryBlocks(listingId).then((res) => res.data),
    enabled: Boolean(listingId),
    staleTime: 15_000,
  });
}

export default useInventoryBlocksQuery;
