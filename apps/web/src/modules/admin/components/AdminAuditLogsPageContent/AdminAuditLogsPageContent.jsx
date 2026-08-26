/**
 * AdminAuditLogsPageContent — `/:locale/admin/audit-logs` (Stage 11.7:
 * Audit Logs). Same orchestrator shape as `AdminBookingsPageContent`
 * (URL-synced filters via `useAdminListFilters` over
 * `useAdminAuditLogsQuery`, rendered via the shared `DataTable`
 * primitive) — but view-only: no row actions, no mutations, no detail
 * page. `action` is a free-text filter (the action-string catalog spans
 * every module and is too large to enumerate as a `Select`, unlike
 * `targetType`, which is a short, stable list).
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Input, Select } from '@desavii/ui/components/form-controls';
import { DataTable } from '@desavii/ui/components/dashboard';
import { ErrorState } from '@desavii/ui/components/feedback-overlays';
import { Search } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAdminListFilters } from '../../hooks/useAdminListFilters.js';
import { useAdminAuditLogsQuery } from '../../queries/useAdminAuditLogsQuery.js';

const DEFAULT_FILTERS = { targetType: '', action: '' };

const TARGET_TYPES = [
  'user',
  'partner',
  'listing',
  'booking',
  'cms_page',
  'bookable_unit',
  'availability_calendar',
  'blackout_date',
  'listing_category',
  'listing_amenity',
  'pricing_model',
  'country',
  'region',
  'city',
];

export default function AdminAuditLogsPageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();

  const { filters, updateFilters } = useAdminListFilters(DEFAULT_FILTERS);
  const [actionText, setActionText] = useState(filters.action);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminAuditLogsQuery({
    targetType: filters.targetType,
    action: filters.action,
  });

  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const targetTypeOptions = [
    { value: '', label: t('admin.auditLogs.filters.targetTypeAll') },
    ...TARGET_TYPES.map((code) => ({
      value: code,
      label: t(`admin.auditLogs.targetType.${code}`, { defaultValue: code }),
    })),
  ];

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  );

  const columns = [
    {
      key: 'createdAt',
      header: t('admin.auditLogs.table.timestamp'),
      render: (entry) => dateFormatter.format(new Date(entry.created_at)),
    },
    {
      key: 'actor',
      header: t('admin.auditLogs.table.actor'),
      render: (entry) => entry.actor_name || t('admin.auditLogs.systemActor'),
    },
    { key: 'action', header: t('admin.auditLogs.table.action') },
    {
      key: 'target',
      header: t('admin.auditLogs.table.target'),
      render: (entry) => `${entry.target_type} #${entry.target_id}`,
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.auditLogs.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.auditLogs.heading'),
            href: `/${locale}/admin/audit-logs`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.auditLogs.error.title')}
          retryLabel={t('admin.auditLogs.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <Inline gap="3" wrap>
            <Input
              aria-label={t('admin.auditLogs.filters.actionLabel')}
              placeholder={t('admin.auditLogs.filters.actionPlaceholder')}
              value={actionText}
              onChange={(event) => setActionText(event.target.value)}
              onBlur={() => updateFilters({ action: actionText })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  updateFilters({ action: actionText });
                }
              }}
              iconLeft={<Search size={18} aria-hidden="true" />}
            />
            <Select
              ariaLabel={t('admin.auditLogs.filters.targetTypeLabel')}
              options={targetTypeOptions}
              value={filters.targetType}
              onChange={(value) => updateFilters({ targetType: value })}
            />
          </Inline>

          <DataTable
            columns={columns}
            rows={entries}
            isLoading={isPending}
            emptyTitle={t('admin.auditLogs.empty.title')}
            emptyDescription={t('admin.auditLogs.empty.description')}
            hasMore={Boolean(hasNextPage)}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            loadMoreLabel={t('admin.auditLogs.loadMore')}
          />
        </Stack>
      )}
    </Section>
  );
}
