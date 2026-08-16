/**
 * NotificationsPageContent — the full `/:locale/{account,partner,admin}/
 * notifications` page. Role-agnostic (the backend already scopes by
 * `principal.userId`), so the same component is reused across all three
 * route wrappers (Phase 13's "Support: Customer/Partner/Admin
 * notifications" requirement) — only the route/layout differs.
 *
 * Search is local debounced state (`DestinationAutocomplete`'s manual
 * `setTimeout`/`clearTimeout` idiom), not URL-synced — this page has no
 * shareable/bookmarkable-filter requirement the way `search` does.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { Button } from '@travelhub/ui/components/primitives';
import { Input } from '@travelhub/ui/components/form-controls';
import { Tabs } from '@travelhub/ui/components/navigation';
import { Section, Stack } from '@travelhub/ui/components/layout';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useNotificationsQuery } from '../../queries/useNotificationsQuery.js';
import { useMarkNotificationReadMutation } from '../../mutations/useMarkNotificationReadMutation.js';
import { useMarkAllNotificationsReadMutation } from '../../mutations/useMarkAllNotificationsReadMutation.js';
import { useArchiveNotificationMutation } from '../../mutations/useArchiveNotificationMutation.js';
import { useDeleteNotificationMutation } from '../../mutations/useDeleteNotificationMutation.js';
import NotificationRow from '../NotificationRow/NotificationRow.jsx';
import styles from './NotificationsPageContent.module.scss';

const DEBOUNCE_MS = 300;
const CATEGORIES = [
  'BOOKING',
  'REVIEW',
  'FAVORITE',
  'PARTNER',
  'LISTING',
  'ADMIN',
];

function NotificationsSkeletonList() {
  return (
    <Stack gap="2">
      {Array.from({ length: 5 }, (_, index) => (
        // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
        <Skeleton key={index} variant="rect" height={64} />
      ))}
    </Stack>
  );
}

export default function NotificationsPageContent() {
  const { t } = useTranslation();
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(searchInput),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchInput]);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationsQuery({
    status,
    category,
    search: debouncedSearch || undefined,
  });

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const archiveMutation = useArchiveNotificationMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const notifications = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const tabs = [
    { id: 'all', label: t('notifications.page.tabs.all') },
    { id: 'unread', label: t('notifications.page.tabs.unread') },
    { id: 'archived', label: t('notifications.page.tabs.archived') },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('notifications.page.heading')}
        actions={
          <Button variant="ghost" onClick={() => markAllReadMutation.mutate()}>
            {t('notifications.actions.markAllAsRead')}
          </Button>
        }
      />

      <Stack gap="4">
        <Tabs
          tabs={tabs}
          activeTabId={status}
          onChange={setStatus}
          ariaLabel={t('notifications.page.tabs.ariaLabel')}
        />

        <div className={styles.filters}>
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('notifications.page.searchPlaceholder')}
            size="sm"
          />
          <div
            className={styles.categoryChips}
            role="group"
            aria-label={t('notifications.page.categoryFilterLabel')}
          >
            <button
              type="button"
              className={[
                styles.chip,
                category === undefined && styles['chip--active'],
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setCategory(undefined)}
            >
              {t('notifications.page.allCategories')}
            </button>
            {CATEGORIES.map((code) => (
              <button
                key={code}
                type="button"
                className={[
                  styles.chip,
                  category === code && styles['chip--active'],
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setCategory(code)}
              >
                {t(`notifications.categories.${code}`)}
              </button>
            ))}
          </div>
        </div>

        {isError && (
          <ErrorState
            title={t('notifications.page.errorTitle')}
            retryLabel={t('notifications.page.errorRetry')}
            onRetry={() => refetch()}
          />
        )}
        {!isError && isPending && <NotificationsSkeletonList />}
        {!isError && !isPending && notifications.length === 0 && (
          <EmptyState
            title={t('notifications.page.emptyTitle')}
            description={t('notifications.page.emptyDescription')}
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
        {hasNextPage && (
          <Button
            variant="ghost"
            onClick={() => fetchNextPage()}
            loading={isFetchingNextPage}
          >
            {t('notifications.page.loadMore')}
          </Button>
        )}
      </Stack>
    </Section>
  );
}
