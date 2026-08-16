/**
 * ConversationListItem — one row, shared by `MessagingDropdown` (compact)
 * and `ConversationList` (full page). Shows the OTHER participant(s)
 * (`conversation.participants` never includes the requester — see
 * `conversationService.#attachParticipants`), a last-message preview, a
 * relative timestamp, and an unread badge.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Avatar, Badge } from '@travelhub/ui/components/primitives';
import {
  getParticipantDisplayName,
  getConversationTitle,
} from '../../utils/getParticipantDisplayName.js';
import { formatRelativeTime } from '../../utils/formatRelativeTime.js';
import styles from './ConversationListItem.module.scss';

export default function ConversationListItem({
  conversation,
  isActive = false,
  onClick,
}) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const primaryParticipant = conversation.participants?.[0] ?? null;
  const title = getConversationTitle(conversation.participants, t);
  const hasUnread = (conversation.unread_count ?? 0) > 0;

  return (
    <li className={styles.item}>
      <button
        type="button"
        className={[styles.button, isActive && styles['button--active']]
          .filter(Boolean)
          .join(' ')}
        onClick={onClick}
      >
        <Avatar
          src={primaryParticipant?.avatar_url}
          name={getParticipantDisplayName(primaryParticipant, t)}
          userId={String(primaryParticipant?.user_id ?? '')}
          size="md"
        />
        <div className={styles.body}>
          <div className={styles.headerRow}>
            <span className={styles.title}>{title}</span>
            {conversation.last_message_at && (
              <span className={styles.timestamp}>
                {formatRelativeTime(conversation.last_message_at, locale)}
              </span>
            )}
          </div>
          <div className={styles.previewRow}>
            <span
              className={[
                styles.preview,
                hasUnread && styles['preview--unread'],
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {conversation.last_message_preview ??
                t('messaging.list.noMessagesYet')}
            </span>
            {hasUnread && (
              <Badge
                variant="info"
                size="sm"
                filled
                label={String(conversation.unread_count)}
              />
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

ConversationListItem.propTypes = {
  // Real GET /messaging/conversations row shape, not a hand-authored
  // prop contract (same convention `NotificationRow` follows).
  // eslint-disable-next-line react/forbid-prop-types
  conversation: PropTypes.object.isRequired,
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};
