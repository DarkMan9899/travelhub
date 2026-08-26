/**
 * NotificationBell — the Header's notification entry point, added to
 * every protected/public layout's `actions` fragment next to `UserMenu`
 * (Phase 13). Copies `UserMenu.jsx`'s exact `Popover placement="bottom-end"`
 * + `aria-haspopup="menu"`/`aria-expanded` trigger-button pattern, and
 * `FavoriteButton`'s precedent of rendering `null` for a logged-out
 * visitor — a notification is always the requester's own.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { Popover } from '@desavii/ui/components/navigation';
import { Icon } from '@desavii/ui/components/primitives';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useUnreadCountQuery } from '../../queries/useUnreadCountQuery.js';
import NotificationDropdown from '../NotificationDropdown/NotificationDropdown.jsx';
import styles from './NotificationBell.module.scss';

export default function NotificationBell() {
  const { t } = useTranslation();
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadCountQuery({
    enabled: isAuthenticated,
  });

  if (isBootstrapping || !isAuthenticated) {
    return null;
  }

  const displayCount = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <Popover
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-end"
      panelClassName={styles.panel}
      trigger={
        <button
          type="button"
          className={styles.trigger}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={
            unreadCount > 0
              ? t('notifications.bell.labelWithCount', { count: unreadCount })
              : t('notifications.bell.label')
          }
          onClick={() => setIsOpen((current) => !current)}
        >
          <Icon icon={Bell} size="md" />
          {unreadCount > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {displayCount}
            </span>
          )}
        </button>
      }
    >
      <NotificationDropdown onNavigate={() => setIsOpen(false)} />
    </Popover>
  );
}
