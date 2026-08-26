/**
 * MessagingBell — the Header's messaging entry point, added to every
 * protected layout's `actions` fragment next to `NotificationBell`
 * (Phase 14). Copies `NotificationBell.jsx`'s exact `Popover
 * placement="bottom-end"` + `aria-haspopup="menu"`/`aria-expanded`
 * trigger-button pattern, and its precedent of rendering `null` for a
 * logged-out visitor — a conversation is always the requester's own.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { Popover } from '@desavii/ui/components/navigation';
import { Icon } from '@desavii/ui/components/primitives';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useUnreadConversationCountQuery } from '../../queries/useUnreadConversationCountQuery.js';
import MessagingDropdown from '../MessagingDropdown/MessagingDropdown.jsx';
import styles from './MessagingBell.module.scss';

export default function MessagingBell() {
  const { t } = useTranslation();
  const { isAuthenticated, isBootstrapping } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { data: unreadCount = 0 } = useUnreadConversationCountQuery({
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
              ? t('messaging.bell.labelWithCount', { count: unreadCount })
              : t('messaging.bell.label')
          }
          onClick={() => setIsOpen((current) => !current)}
        >
          <Icon icon={MessageCircle} size="md" />
          {unreadCount > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {displayCount}
            </span>
          )}
        </button>
      }
    >
      <MessagingDropdown onNavigate={() => setIsOpen(false)} />
    </Popover>
  );
}
