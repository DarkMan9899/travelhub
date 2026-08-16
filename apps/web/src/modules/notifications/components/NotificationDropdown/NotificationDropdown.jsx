/**
 * NotificationDropdown — the compact panel inside `NotificationBell`'s
 * Popover: the most recent notifications, "Mark all as read", and a
 * "View all" link to the full `NotificationsPageContent` page.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { Button } from '@travelhub/ui/components/primitives';
import { useNotificationsQuery } from '../../queries/useNotificationsQuery.js';
import { useMarkNotificationReadMutation } from '../../mutations/useMarkNotificationReadMutation.js';
import { useMarkAllNotificationsReadMutation } from '../../mutations/useMarkAllNotificationsReadMutation.js';
import { useArchiveNotificationMutation } from '../../mutations/useArchiveNotificationMutation.js';
import { useDeleteNotificationMutation } from '../../mutations/useDeleteNotificationMutation.js';
import NotificationRow from '../NotificationRow/NotificationRow.jsx';
import styles from './NotificationDropdown.module.scss';

const DROPDOWN_LIMIT = 6;

export default function NotificationDropdown({ onNavigate = undefined }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError, refetch } = useNotificationsQuery({
    limit: DROPDOWN_LIMIT,
  });
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const archiveMutation = useArchiveNotificationMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const notifications = data?.pages[0]?.results ?? [];

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <p className={styles.title}>{t('notifications.dropdown.title')}</p>
        {notifications.some((notification) => !notification.is_read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
          >
            {t('notifications.actions.markAllAsRead')}
          </Button>
        )}
      </div>

      {isError && (
        <ErrorState
          title={t('notifications.dropdown.errorTitle')}
          retryLabel={t('notifications.dropdown.errorRetry')}
          onRetry={() => refetch()}
        />
      )}
      {!isError && isPending && (
        <div className={styles.skeletonList}>
          {Array.from({ length: 3 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
            <Skeleton key={index} variant="rect" height={56} />
          ))}
        </div>
      )}
      {!isError && !isPending && notifications.length === 0 && (
        <EmptyState
          title={t('notifications.dropdown.emptyTitle')}
          description={t('notifications.dropdown.emptyDescription')}
        />
      )}
      {!isError && !isPending && notifications.length > 0 && (
        <ul className={styles.list}>
          {notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onArchive={(id) => archiveMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))}
        </ul>
      )}

      <Link
        to={`/${locale}/account/notifications`}
        className={styles.viewAll}
        onClick={onNavigate}
      >
        {t('notifications.dropdown.viewAll')}
      </Link>
    </div>
  );
}

NotificationDropdown.propTypes = {
  onNavigate: PropTypes.func,
};
