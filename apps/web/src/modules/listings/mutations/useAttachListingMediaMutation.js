/**
 * `useAttachListingMediaMutation` — wraps `POST /listings/:id/media`
 * (FRONTEND_ARCHITECTURE.md §14.5). One request per file (the backend
 * has no multi-file endpoint — see `api/listings.js`'s
 * `attachListingMedia` doc comment); `MediaStep` calls this once per
 * file dropped into `FileDropzone`, tracking each call's own
 * pending/error state for per-file upload progress.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attachListingMedia } from '../../../api/listings.js';
import listingKeys from '../constants/queryKeys.js';

export function useAttachListingMediaMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }) => attachListingMedia(id, file),
    onSuccess: (_response, { id }) => {
      queryClient.invalidateQueries({ queryKey: listingKeys.detail(id) });
    },
  });
}

export default useAttachListingMediaMutation;
