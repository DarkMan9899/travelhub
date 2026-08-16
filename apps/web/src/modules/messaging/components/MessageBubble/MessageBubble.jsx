/**
 * MessageBubble — one message inside `ChatWindow`. Aligns right for the
 * requester's own messages, left for everyone else's (the standard chat
 * convention). Shows attachment previews (image thumbnail via `<img>`,
 * generic file link for documents — matches the brief's "Attachment
 * preview" requirement), a grouped reaction row, and a fixed quick-react
 * row (Phase 14 scope decision #5 — a small closed set, not an open
 * emoji picker).
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
import { Icon } from '@travelhub/ui/components/primitives';
import { REACTION_CODES } from '../../constants/reactionCodes.js';
import { formatRelativeTime } from '../../utils/formatRelativeTime.js';
import styles from './MessageBubble.module.scss';

function groupReactions(reactions) {
  const groups = new Map();
  reactions.forEach((reaction) => {
    const list = groups.get(reaction.reaction_code) ?? [];
    list.push(reaction.user_id);
    groups.set(reaction.reaction_code, list);
  });
  return groups;
}

export default function MessageBubble({
  message,
  isOwnMessage,
  senderName = undefined,
  currentUserId = undefined,
  canDelete = false,
  canReact = true,
  onDelete = undefined,
  onToggleReaction,
}) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const reactionGroups = useMemo(
    () => groupReactions(message.reactions ?? []),
    [message.reactions],
  );

  return (
    <li
      className={[styles.bubbleRow, isOwnMessage && styles['bubbleRow--own']]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.bubble}>
        {!isOwnMessage && senderName && (
          <p className={styles.sender}>{senderName}</p>
        )}
        <p className={styles.body}>{message.body}</p>

        {message.attachments?.length > 0 && (
          <ul className={styles.attachments}>
            {message.attachments.map((attachment) => (
              <li key={attachment.id} className={styles.attachment}>
                {attachment.media_type === 'IMAGE' ? (
                  <a href={attachment.url} target="_blank" rel="noreferrer">
                    <img
                      src={attachment.url}
                      alt={t('messaging.thread.attachmentAlt')}
                      className={styles.attachmentImage}
                    />
                  </a>
                ) : (
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.attachmentFile}
                  >
                    <Icon icon={Paperclip} size="sm" />
                    <span>{attachment.media_type}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.meta}>
          <span className={styles.timestamp}>
            {formatRelativeTime(message.created_at, locale)}
          </span>
          {message.is_edited && (
            <span className={styles.edited}>
              {t('messaging.thread.edited')}
            </span>
          )}
        </div>

        {reactionGroups.size > 0 && (
          <div className={styles.reactionRow}>
            {Array.from(reactionGroups.entries()).map(([code, userIds]) =>
              // A `messaging.view_all` reader who isn't a real participant
              // can see reactions but can't add/remove them (the backend's
              // `assertCanWrite` would 403) — render as a static chip
              // instead of an interactive control they can't actually use.
              canReact ? (
                <button
                  key={code}
                  type="button"
                  className={[
                    styles.reactionChip,
                    userIds.includes(currentUserId) &&
                      styles['reactionChip--active'],
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={t(`messaging.reactions.${code}`)}
                  onClick={() => onToggleReaction(code)}
                >
                  <span aria-hidden="true">{code}</span>
                  <span>{userIds.length}</span>
                </button>
              ) : (
                <span key={code} className={styles.reactionChip}>
                  <span aria-hidden="true">{code}</span>
                  <span>{userIds.length}</span>
                </span>
              ),
            )}
          </div>
        )}

        {(canReact || canDelete) && (
          <div className={styles.actionsRow}>
            {canReact &&
              REACTION_CODES.map((code) => (
                <button
                  key={code}
                  type="button"
                  className={styles.quickReact}
                  aria-label={t(`messaging.reactions.${code}`)}
                  onClick={() => onToggleReaction(code)}
                >
                  {code}
                </button>
              ))}
            {canDelete && (
              <button
                type="button"
                className={styles.deleteButton}
                onClick={() => onDelete(message.id)}
              >
                {t('messaging.actions.delete')}
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

MessageBubble.propTypes = {
  // Real GET .../messages row shape, not a hand-authored prop contract.
  // eslint-disable-next-line react/forbid-prop-types
  message: PropTypes.object.isRequired,
  isOwnMessage: PropTypes.bool.isRequired,
  senderName: PropTypes.string,
  currentUserId: PropTypes.number,
  canDelete: PropTypes.bool,
  canReact: PropTypes.bool,
  onDelete: PropTypes.func,
  onToggleReaction: PropTypes.func.isRequired,
};
