/**
 * `useRemoveListingMediaMutation` — wraps `DELETE
 * /listings/:id/media/:mediaId` (FRONTEND_ARCHITECTURE.md §14.5).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeListingMedia } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useRemoveListingMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, mediaId }) => removeListingMedia(id, mediaId),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useRemoveListingMediaMutation;
