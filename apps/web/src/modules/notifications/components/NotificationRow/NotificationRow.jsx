/**
 * NotificationRow — one notification, shared by `NotificationDropdown`
 * (compact) and `NotificationsPageContent` (full list). Renders its
 * message via `notificationCopy.js` — the backend stores only
 * `event_type` + `payload`, never rendered text (Phase 4.2's "i18n owns
 * all labels" rule).
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  Star,
  Heart,
  Building2,
  Home,
  Megaphone,
  Bell,
} from 'lucide-react';
import { Icon, Button } from '@travelhub/ui/components/primitives';
import { getNotificationCopy } from '../../constants/notificationCopy.js';
import { formatRelativeTime } from '../../utils/formatRelativeTime.js';
import styles from './NotificationRow.module.scss';

const CATEGORY_ICONS = {
  BOOKING: Calendar,
  REVIEW: Star,
  FAVORITE: Heart,
  PARTNER: Building2,
  LISTING: Home,
  ADMIN: Megaphone,
};

export default function NotificationRow({
  notification,
  onMarkRead,
  onArchive,
  onDelete,
}) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const copy = getNotificationCopy(
    notification.event_type,
    notification.payload,
  );
  const IconComponent = CATEGORY_ICONS[notification.category] ?? Bell;

  return (
    <li
      className={[styles.row, !notification.is_read && styles['row--unread']]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.iconWrap}>
        <Icon icon={IconComponent} size="md" />
      </span>
      <div className={styles.body}>
        <p className={styles.message}>
          {copy.isAnnouncement ? (
            <>
              <strong>{copy.title}</strong>
              {copy.body && <span> — {copy.body}</span>}
            </>
          ) : (
            t(copy.key, copy.params)
          )}
        </p>
        <span className={styles.timestamp}>
          {formatRelativeTime(notification.created_at, locale)}
        </span>
      </div>
      {!notification.is_read && (
        <span
          className={styles.unreadDot}
          role="img"
          aria-label={t('notifications.a11y.unread')}
        />
      )}
      <div className={styles.actions}>
        {!notification.is_read && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onMarkRead(notification.id)}
          >
            {t('notifications.actions.markAsRead')}
          </Button>
        )}
        {!notification.is_archived && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onArchive(notification.id)}
          >
            {t('notifications.actions.archive')}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(notification.id)}
        >
          {t('notifications.actions.delete')}
        </Button>
      </div>
    </li>
  );
}

NotificationRow.propTypes = {
  // Real GET /notifications row shape (FRONTEND_ARCHITECTURE.md §10.8's
  // normalized-but-untyped response), not a hand-authored prop contract.
  // eslint-disable-next-line react/forbid-prop-types
  notification: PropTypes.object.isRequired,
  onMarkRead: PropTypes.func.isRequired,
  onArchive: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
