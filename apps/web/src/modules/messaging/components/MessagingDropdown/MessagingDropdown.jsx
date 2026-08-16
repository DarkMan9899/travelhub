/**
 * MessagingDropdown — the compact panel inside `MessagingBell`'s Popover:
 * the most recent conversations and a "View all" link to the full
 * `MessagingPageContent` page. Mirrors `NotificationDropdown`'s exact
 * structure/shape.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { useConversationsQuery } from '../../queries/useConversationsQuery.js';
import ConversationListItem from '../ConversationListItem/ConversationListItem.jsx';
import styles from './MessagingDropdown.module.scss';

const DROPDOWN_LIMIT = 6;

export default function MessagingDropdown({ onNavigate = undefined }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError, refetch } = useConversationsQuery({
    limit: DROPDOWN_LIMIT,
  });

  const conversations = data?.pages[0]?.results ?? [];

  function openConversation(conversationId) {
    onNavigate?.();
    navigate(`/${locale}/account/messages/${conversationId}`);
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <p className={styles.title}>{t('messaging.dropdown.title')}</p>
      </div>

      {isError && (
        <ErrorState
          title={t('messaging.dropdown.errorTitle')}
          retryLabel={t('messaging.dropdown.errorRetry')}
          onRetry={() => refetch()}
        />
      )}
      {!isError && isPending && (
        <div className={styles.skeletonList}>
          {Array.from({ length: 3 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
            <Skeleton key={index} variant="rect" height={64} />
          ))}
        </div>
      )}
      {!isError && !isPending && conversations.length === 0 && (
        <EmptyState
          title={t('messaging.dropdown.emptyTitle')}
          description={t('messaging.dropdown.emptyDescription')}
        />
      )}
      {!isError && !isPending && conversations.length > 0 && (
        <ul className={styles.list}>
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              onClick={() => openConversation(conversation.id)}
            />
          ))}
        </ul>
      )}

      <Link
        to={`/${locale}/account/messages`}
        className={styles.viewAll}
        onClick={onNavigate}
      >
        {t('messaging.dropdown.viewAll')}
      </Link>
    </div>
  );
}

MessagingDropdown.propTypes = {
  onNavigate: PropTypes.func,
};
