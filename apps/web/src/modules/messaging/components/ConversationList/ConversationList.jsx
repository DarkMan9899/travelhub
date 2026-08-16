/**
 * ConversationList — the full conversation list pane (`MessagingPageContent`'s
 * left column on desktop, the whole screen on mobile until a conversation
 * is opened). Forward "load more" pagination, matching every other list
 * in this codebase (`useConversationsQuery`'s own header comment explains
 * why this list keeps that direction while the message THREAD paginates
 * backward).
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { Button } from '@travelhub/ui/components/primitives';
import { useConversationsQuery } from '../../queries/useConversationsQuery.js';
import ConversationListItem from '../ConversationListItem/ConversationListItem.jsx';
import styles from './ConversationList.module.scss';

export default function ConversationList({
  activeConversationId = undefined,
  onSelectConversation,
  status = 'all',
  search = undefined,
}) {
  const { t } = useTranslation();
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useConversationsQuery({ status, search });

  const conversations = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  return (
    <div className={styles.wrapper}>
      {isError && (
        <ErrorState
          title={t('messaging.list.errorTitle')}
          retryLabel={t('messaging.list.errorRetry')}
          onRetry={() => refetch()}
        />
      )}
      {!isError && isPending && (
        <div className={styles.skeletonList}>
          {Array.from({ length: 5 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
            <Skeleton key={index} variant="rect" height={72} />
          ))}
        </div>
      )}
      {!isError && !isPending && conversations.length === 0 && (
        <EmptyState
          title={t('messaging.list.emptyTitle')}
          description={t('messaging.list.emptyDescription')}
        />
      )}
      {!isError && !isPending && conversations.length > 0 && (
        <ul className={styles.list}>
          {conversations.map((conversation) => (
            <ConversationListItem
              key={conversation.id}
              conversation={conversation}
              isActive={conversation.id === activeConversationId}
              onClick={() => onSelectConversation(conversation.id)}
            />
          ))}
        </ul>
      )}
      {hasNextPage && (
        <div className={styles.loadMore}>
          <Button
            variant="ghost"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
          >
            {t('messaging.list.loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}

ConversationList.propTypes = {
  activeConversationId: PropTypes.number,
  onSelectConversation: PropTypes.func.isRequired,
  status: PropTypes.oneOf(['all', 'archived']),
  search: PropTypes.string,
};
