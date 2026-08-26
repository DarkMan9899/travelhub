/**
 * AdminSystemHealthPageContent — `/:locale/admin/system-health` (Stage
 * 11.8: System Health). Status tiles for Database/Cache/Environment/
 * Version via the shared `StatCard` (same primitive
 * `AdminDashboardOverviewContent` uses), plus a `DataTable` for the
 * BullMQ queues (`booking-holds.expiry-sweep`,
 * `bookings.pending-vendor-sla-sweep`, `notifications.delivery` — see
 * `systemHealthService.js`'s `QUEUE_NAMES`) — no pagination needed for
 * this small a fixed list, but `DataTable` is still the right primitive
 * for its table semantics; the list is data-driven from the response,
 * not hardcoded to a row count here.
 *
 * View-only: no actions, no mutations, matches `useAdminSystemHealthQuery`'s
 * short `staleTime` + refetch-on-focus so this page stays close to live.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Grid } from '@desavii/ui/components/layout';
import { StatCard, DataTable } from '@desavii/ui/components/dashboard';
import { Card } from '@desavii/ui/components/primitives';
import { ErrorState } from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAdminSystemHealthQuery } from '../../queries/useAdminSystemHealthQuery.js';

const STATUS_VARIANT = { up: 'success', down: 'danger' };

export default function AdminSystemHealthPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError, refetch } = useAdminSystemHealthQuery();

  const statusLabel = (status) =>
    t(`admin.systemHealth.status.${status}`, { defaultValue: status });

  const columns = [
    {
      key: 'name',
      header: t('admin.systemHealth.queues.table.name'),
      render: (queue) =>
        t(`admin.systemHealth.queues.name.${queue.name}`, {
          defaultValue: queue.name,
        }),
    },
    {
      key: 'status',
      header: t('admin.systemHealth.queues.table.status'),
      render: (queue) => statusLabel(queue.status),
    },
    {
      key: 'waiting',
      header: t('admin.systemHealth.queues.table.waiting'),
      render: (queue) => queue.waiting ?? '—',
    },
    {
      key: 'active',
      header: t('admin.systemHealth.queues.table.active'),
      render: (queue) => queue.active ?? '—',
    },
    {
      key: 'delayed',
      header: t('admin.systemHealth.queues.table.delayed'),
      render: (queue) => queue.delayed ?? '—',
    },
    {
      key: 'failed',
      header: t('admin.systemHealth.queues.table.failed'),
      render: (queue) => queue.failed ?? '—',
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.systemHealth.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.systemHealth.heading'),
            href: `/${locale}/admin/system-health`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.systemHealth.error.title')}
          retryLabel={t('admin.systemHealth.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="8">
          <Grid columns={4} gap="4">
            <StatCard
              label={t('admin.systemHealth.tiles.database')}
              value={data ? statusLabel(data.database.status) : undefined}
              variant={STATUS_VARIANT[data?.database.status] ?? 'neutral'}
              isLoading={isPending}
            />
            <StatCard
              label={t('admin.systemHealth.tiles.cache')}
              value={data ? statusLabel(data.cache.status) : undefined}
              variant={STATUS_VARIANT[data?.cache.status] ?? 'neutral'}
              isLoading={isPending}
            />
            <StatCard
              label={t('admin.systemHealth.tiles.environment')}
              value={data?.environment}
              variant="neutral"
              isLoading={isPending}
            />
            <StatCard
              label={t('admin.systemHealth.tiles.version')}
              value={data?.version}
              variant="neutral"
              isLoading={isPending}
            />
          </Grid>

          <Card as="div" padding="lg">
            <Stack gap="3">
              <h2>{t('admin.systemHealth.queues.heading')}</h2>
              <DataTable
                columns={columns}
                rows={data?.queues ?? []}
                rowKey={(queue) => queue.name}
                isLoading={isPending}
                emptyTitle={t('admin.systemHealth.queues.empty')}
              />
            </Stack>
          </Card>
        </Stack>
      )}
    </Section>
  );
}
