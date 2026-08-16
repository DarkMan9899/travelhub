/**
 * MessagingPageContent — the full `/:locale/{account,partner,admin}/
 * messages(/:conversationId)` page. Role-agnostic (the backend already
 * scopes by participation/`messaging.view_all`), reused across all three
 * route wrappers exactly like `NotificationsPageContent`.
 *
 * Desktop: two-pane layout (`ConversationList` + `ChatWindow`). Mobile:
 * single-pane — the list until a conversation is selected, then the
 * thread, matching the brief's "Responsive mobile layout" requirement.
 * The selected conversation lives in the URL (`:conversationId`), not
 * local-only state, so a thread is directly linkable/bookmarkable and
 * survives a refresh.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Section } from '@travelhub/ui/components/layout';
import { Tabs } from '@travelhub/ui/components/navigation';
import { Input } from '@travelhub/ui/components/form-controls';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import ConversationList from '../ConversationList/ConversationList.jsx';
import MessageSearchResults from '../MessageSearchResults/MessageSearchResults.jsx';
import ChatWindow from '../ChatWindow/ChatWindow.jsx';
import styles from './MessagingPageContent.module.scss';

const DEBOUNCE_MS = 300;

export default function MessagingPageContent() {
  const { t } = useTranslation();
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(searchInput),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const activeConversationId = conversationId
    ? Number(conversationId)
    : undefined;

  const selectConversation = useCallback(
    (id) => {
      const basePath = location.pathname.replace(/\/\d+$/, '');
      navigate(`${basePath}/${id}`);
    },
    [location.pathname, navigate],
  );

  const tabs = [
    { id: 'all', label: t('messaging.list.tabsAll') },
    { id: 'archived', label: t('messaging.list.tabsArchived') },
  ];

  return (
    <Section spacing="none">
      <PageHeader title={t('messaging.page.heading')} />
      <div className={styles.layout}>
        <div
          className={[
            styles.listPane,
            activeConversationId && styles['listPane--hiddenOnMobile'],
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className={styles.filters}>
            <Tabs
              tabs={tabs}
              activeTabId={status}
              onChange={setStatus}
              ariaLabel={t('messaging.list.tabsAriaLabel')}
            />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('messaging.list.searchPlaceholder')}
              size="sm"
            />
          </div>
          {debouncedSearch && (
            <MessageSearchResults
              query={debouncedSearch}
              onSelectConversation={selectConversation}
            />
          )}
          <ConversationList
            activeConversationId={activeConversationId}
            onSelectConversation={selectConversation}
            status={status}
            search={debouncedSearch || undefined}
          />
        </div>
        <div
          className={[
            styles.chatPane,
            !activeConversationId && styles['chatPane--hiddenOnMobile'],
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {activeConversationId ? (
            <ChatWindow conversationId={activeConversationId} />
          ) : (
            <p className={styles.selectPrompt}>
              {t('messaging.thread.selectPrompt')}
            </p>
          )}
        </div>
      </div>
    </Section>
  );
}
