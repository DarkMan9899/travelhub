/**
 * MessageComposer — textarea + attachment picker + send button. Calls
 * `useSetTypingMutation` on keystroke, throttled to once per
 * `TYPING_PING_INTERVAL_MS` (matches the backend's 6s TTL — pinging more
 * often than that would be pure waste) rather than the debounced-search
 * idiom (`DestinationAutocomplete`'s trailing-edge debounce would delay
 * the FIRST ping until the user pauses, which is backwards for a "still
 * typing" signal — this needs a leading, throttled ping instead).
 *
 * Attachments upload immediately on selection (two-step flow — see
 * `api/messaging.js`'s `uploadMessageAttachment` header comment); their
 * returned media ids are held in local state until the message is sent.
 */

import { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Paperclip, Send, X } from 'lucide-react';
import { Textarea } from '@travelhub/ui/components/form-controls';
import { Button, Icon } from '@travelhub/ui/components/primitives';
import { useSendMessageMutation } from '../../mutations/useSendMessageMutation.js';
import { useUploadAttachmentMutation } from '../../mutations/useUploadAttachmentMutation.js';
import { useSetTypingMutation } from '../../mutations/useSetTypingMutation.js';
import styles from './MessageComposer.module.scss';

const TYPING_PING_INTERVAL_MS = 5000;

export default function MessageComposer({ conversationId }) {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const lastTypingPingAt = useRef(0);
  const fileInputRef = useRef(null);

  const sendMessageMutation = useSendMessageMutation(conversationId);
  const uploadAttachmentMutation = useUploadAttachmentMutation(conversationId);
  const setTypingMutation = useSetTypingMutation(conversationId);

  const handleBodyChange = useCallback(
    (event) => {
      setBody(event.target.value);
      const now = Date.now();
      if (now - lastTypingPingAt.current > TYPING_PING_INTERVAL_MS) {
        lastTypingPingAt.current = now;
        setTypingMutation.mutate();
      }
    },
    [setTypingMutation],
  );

  async function handleFilesSelected(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    // Sequential, not `Promise.all` — one file at a time matches the
    // backend's one-file-per-request upload route.
    await files.reduce(async (previous, file) => {
      await previous;
      const { data } = await uploadAttachmentMutation.mutateAsync(file);
      setPendingAttachments((current) => [...current, data]);
    }, Promise.resolve());
  }

  function removePendingAttachment(mediaId) {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== mediaId),
    );
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedBody = body.trim();
    if (!trimmedBody && pendingAttachments.length === 0) return;

    sendMessageMutation.mutate(
      {
        body: trimmedBody,
        attachmentMediaIds: pendingAttachments.map((a) => a.id),
      },
      {
        onSuccess: () => {
          setBody('');
          setPendingAttachments([]);
        },
      },
    );
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      {pendingAttachments.length > 0 && (
        <ul className={styles.pendingList}>
          {pendingAttachments.map((attachment) => (
            <li key={attachment.id} className={styles.pendingItem}>
              <span>{attachment.media_type}</span>
              <button
                type="button"
                onClick={() => removePendingAttachment(attachment.id)}
                aria-label={t('messaging.actions.delete')}
              >
                <Icon icon={X} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <button
          type="button"
          className={styles.attachButton}
          aria-label={t('messaging.thread.attach')}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAttachmentMutation.isPending}
        >
          <Icon icon={Paperclip} size="sm" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          hidden
          onChange={handleFilesSelected}
        />
        <Textarea
          value={body}
          onChange={handleBodyChange}
          placeholder={t('messaging.thread.composerPlaceholder')}
          rows={1}
          autoResize
        />
        <Button
          type="submit"
          size="sm"
          iconLeft={<Icon icon={Send} size="sm" />}
          ariaLabel={t('messaging.thread.send')}
          loading={sendMessageMutation.isPending}
          disabled={!body.trim() && pendingAttachments.length === 0}
        />
      </div>
    </form>
  );
}

MessageComposer.propTypes = {
  conversationId: PropTypes.number.isRequired,
};
