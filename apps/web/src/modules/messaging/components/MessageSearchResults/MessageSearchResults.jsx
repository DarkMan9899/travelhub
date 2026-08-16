/**
 * MessageSearchResults — message-body search results (`GET
 * /messaging/messages/search?q=`), shown under the conversation list
 * while the search box has a query. Distinct from `ConversationList`'s
 * own `search` param (which filters conversations by participant name/
 * last-message preview, not message body content) — this is "find a
 * specific message you remember", that is "find who you were talking
 * to". Both run off the same debounced input, side by side.
 *
 * The search endpoint returns bare message rows (id, conversation_id,
 * sender_user_id, body, created_at — no participant data), so titles are
 * resolved by cross-referencing the conversation list already loaded by
 * `useConversationsQuery` (no extra endpoint, no new join) — a
 * conversation outside that list's first page falls back to a generic
 * label rather than showing nothing.
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Skeleton,
  EmptyState,
} from '@travelhub/ui/components/feedback-overlays';
import { useMessageSearchQuery } from '../../queries/useMessageSearchQuery.js';
import { useConversationsQuery } from '../../queries/useConversationsQuery.js';
import { getConversationTitle } from '../../utils/getParticipantDisplayName.js';
import { formatRelativeTime } from '../../utils/formatRelativeTime.js';
import styles from './MessageSearchResults.module.scss';

export default function MessageSearchResults({ query, onSelectConversation }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data: searchData, isPending } = useMessageSearchQuery(query);
  const { data: conversationsData } = useConversationsQuery({});

  const titleByConversationId = useMemo(() => {
    const map = new Map();
    const conversations = (conversationsData?.pages ?? []).flatMap(
      (page) => page.results,
    );
    conversations.forEach((conversation) => {
      map.set(
        conversation.id,
        getConversationTitle(conversation.participants, t),
      );
    });
    return map;
  }, [conversationsData, t]);

  const results = searchData ?? [];

  return (
    <div className={styles.wrapper}>
      <p className={styles.heading}>{t('messaging.search.heading')}</p>
      {isPending && (
        <div className={styles.skeletonList}>
          {Array.from({ length: 3 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
            <Skeleton key={index} variant="rect" height={56} />
          ))}
        </div>
      )}
      {!isPending && results.length === 0 && (
        <EmptyState
          title={t('messaging.search.emptyTitle')}
          description={t('messaging.search.emptyDescription')}
        />
      )}
      {!isPending && results.length > 0 && (
        <ul className={styles.list}>
          {results.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                className={styles.item}
                onClick={() => onSelectConversation(message.conversation_id)}
              >
                <span className={styles.title}>
                  {titleByConversationId.get(message.conversation_id) ??
                    t('messaging.search.unknownConversation')}
                </span>
                <span className={styles.body}>{message.body}</span>
                <span className={styles.timestamp}>
                  {formatRelativeTime(message.created_at, locale)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

MessageSearchResults.propTypes = {
  query: PropTypes.string.isRequired,
  onSelectConversation: PropTypes.func.isRequired,
};
