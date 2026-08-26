/**
 * ChatWindow — the message thread pane: header (other participant's
 * name), the message list (oldest-to-newest top-to-bottom, "load
 * earlier" at the top per `useConversationMessagesQuery`'s backward-
 * pagination contract), a typing indicator, and `MessageComposer`.
 *
 * Subscribes to `subscribeToConversation` (the Phase 14 transport seam)
 * while mounted, refetching messages/typing state on each tick — today
 * that means polling; swapping it for a socket.io listener later only
 * touches `messagingTransport.js`.
 */

import { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useConversationQuery } from '../../queries/useConversationQuery.js';
import { useConversationMessagesQuery } from '../../queries/useConversationMessagesQuery.js';
import { useTypingUsersQuery } from '../../queries/useTypingUsersQuery.js';
import { useMarkConversationReadMutation } from '../../mutations/useMarkConversationReadMutation.js';
import { useDeleteMessageMutation } from '../../mutations/useDeleteMessageMutation.js';
import { useToggleReactionMutation } from '../../mutations/useToggleReactionMutation.js';
import { useArchiveConversationMutation } from '../../mutations/useArchiveConversationMutation.js';
import { subscribeToConversation } from '../../api/messagingTransport.js';
import {
  getParticipantDisplayName,
  getConversationTitle,
} from '../../utils/getParticipantDisplayName.js';
import MessageBubble from '../MessageBubble/MessageBubble.jsx';
import MessageComposer from '../MessageComposer/MessageComposer.jsx';
import styles from './ChatWindow.module.scss';

export default function ChatWindow({ conversationId }) {
  const { t } = useTranslation();
  const { user, permissions } = useAuth();

  const conversationQuery = useConversationQuery(conversationId);
  const messagesQuery = useConversationMessagesQuery(conversationId);
  const typingUsersQuery = useTypingUsersQuery(conversationId);
  const markReadMutation = useMarkConversationReadMutation(conversationId);
  const deleteMessageMutation = useDeleteMessageMutation(conversationId);
  const toggleReactionMutation = useToggleReactionMutation(conversationId);
  const archiveMutation = useArchiveConversationMutation(conversationId);

  const messages = useMemo(
    () =>
      [...(messagesQuery.data?.pages ?? [])]
        .reverse()
        .flatMap((page) => page.results),
    [messagesQuery.data],
  );

  useEffect(() => {
    const unsubscribe = subscribeToConversation(conversationId, () => {
      messagesQuery.refetch();
      typingUsersQuery.refetch();
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resubscribing on every refetch identity change would defeat the poll interval
  }, [conversationId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const conversation = conversationQuery.data;
    if (!conversation || (conversation.unread_count ?? 0) === 0) return;
    const lastMessage = messages[messages.length - 1];
    if (conversation.last_read_message_id === lastMessage.id) return;
    markReadMutation.mutate(lastMessage.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the message set or the conversation's read state actually changes
  }, [messages, conversationQuery.data?.unread_count]);

  const conversation = conversationQuery.data;
  const participants = conversation?.participants ?? [];
  const title = getConversationTitle(participants, t);
  // Only a real participant's conversation response carries this field
  // (see `conversationDto.js`) — a `messaging.view_all` reader looking at
  // someone else's conversation gets the bare shape instead, and every
  // write action (send, react, archive) would 403 for them server-side.
  const isParticipant = conversation?.is_archived_for_participant !== undefined;

  const typingUserIds = typingUsersQuery.data ?? [];
  const typingParticipant = participants.find((participant) =>
    typingUserIds.includes(participant.user_id),
  );

  function senderNameFor(message) {
    const participant = participants.find(
      (candidate) => candidate.user_id === message.sender_user_id,
    );
    return getParticipantDisplayName(participant, t);
  }

  if (conversationQuery.isError || messagesQuery.isError) {
    return (
      <ErrorState
        title={t('messaging.thread.errorTitle')}
        retryLabel={t('messaging.thread.errorRetry')}
        onRetry={() => {
          conversationQuery.refetch();
          messagesQuery.refetch();
        }}
      />
    );
  }

  if (conversationQuery.isPending || messagesQuery.isPending) {
    return (
      <div className={styles.skeletonWrapper}>
        {Array.from({ length: 4 }, (_, index) => (
          // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
          <Skeleton key={index} variant="rect" height={48} />
        ))}
      </div>
    );
  }

  return (
    <div className={styles.window}>
      <div className={styles.header}>
        <p className={styles.title}>{title}</p>
        {/* Only a real participant's response includes this field at all
            (see `conversationDto.js`) — a `messaging.view_all` reader
            looking at a conversation they don't belong to gets the bare
            shape instead, and archiving isn't something they can do
            (`assertCanWrite` requires real participation), so the
            control is hidden rather than shown-but-guaranteed-to-403. */}
        {isParticipant && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              archiveMutation.mutate(!conversation.is_archived_for_participant)
            }
            loading={archiveMutation.isPending}
          >
            {conversation.is_archived_for_participant
              ? t('messaging.actions.unarchive')
              : t('messaging.actions.archive')}
          </Button>
        )}
      </div>

      <div className={styles.messageListWrapper}>
        {messagesQuery.hasNextPage && (
          <div className={styles.loadEarlier}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => messagesQuery.fetchNextPage()}
              loading={messagesQuery.isFetchingNextPage}
            >
              {t('messaging.thread.loadEarlier')}
            </Button>
          </div>
        )}

        {messages.length === 0 ? (
          <EmptyState
            title={t('messaging.thread.emptyTitle')}
            description={t('messaging.thread.emptyDescription')}
          />
        ) : (
          <ul className={styles.messageList}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.sender_user_id === user.id}
                senderName={senderNameFor(message)}
                currentUserId={user.id}
                canDelete={
                  message.sender_user_id === user.id ||
                  permissions.includes('messaging.moderate')
                }
                canReact={isParticipant}
                onDelete={(messageId) =>
                  deleteMessageMutation.mutate(messageId)
                }
                onToggleReaction={(reactionCode) =>
                  toggleReactionMutation.mutate({
                    messageId: message.id,
                    reactionCode,
                  })
                }
              />
            ))}
          </ul>
        )}
      </div>

      {typingParticipant && (
        <p className={styles.typingIndicator}>
          {t('messaging.thread.typingOne', {
            name: getParticipantDisplayName(typingParticipant, t),
          })}
        </p>
      )}

      {isParticipant && <MessageComposer conversationId={conversationId} />}
    </div>
  );
}

ChatWindow.propTypes = {
  conversationId: PropTypes.number.isRequired,
};
