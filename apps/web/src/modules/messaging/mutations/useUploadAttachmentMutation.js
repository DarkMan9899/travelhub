/**
 * `useUploadAttachmentMutation` — wraps
 * `POST /messaging/conversations/:id/attachments`. No cache invalidation:
 * the returned media id is held in the composer's own local state and
 * passed as `attachmentMediaIds` to `useSendMessageMutation` — nothing
 * reads this data until a message actually references it.
 */

import { useMutation } from '@tanstack/react-query';
import { uploadMessageAttachment } from '../../../api/messaging.js';

export function useUploadAttachmentMutation(conversationId) {
  return useMutation({
    mutationFn: (file) => uploadMessageAttachment(conversationId, file),
  });
}

export default useUploadAttachmentMutation;
