/**
 * `useUpdateListingMediaMutation` — wraps `PATCH
 * /listings/:id/media/:mediaId` (FRONTEND_ARCHITECTURE.md §14.5).
 * `MediaStep` calls this for both drag-reordering (`position`) and cover-
 * image selection (`isCover`) — the same one endpoint, never two.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateListingMedia } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useUpdateListingMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mediaId, payload }) =>
      updateListingMedia(id, mediaId, payload),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useUpdateListingMediaMutation;
