/**
 * AdminDashboardOverviewContent — `/:locale/admin` (Admin Platform
 * Dashboard). Phase 11's first real Admin page. Reuses `StatCard`/`Chart`
 * (both `packages/ui` — `Chart` new this phase) rather than inventing
 * page-local widgets, same "reuse the shared dashboard primitives"
 * approach `PartnerDashboardOverviewContent` established.
 *
 * "Booking value" (never "Revenue" — see `adminDto.js`'s doc comment for
 * why) is grouped by currency and rendered as a small list rather than a
 * single number, since summing across currencies would be meaningless.
 */

import { useTranslation } from 'react-i18next';
import { Section, Stack, Grid, Inline } from '@travelhub/ui/components/layout';
import { StatCard, Chart } from '@travelhub/ui/components/dashboard';
import { Card } from '@travelhub/ui/components/primitives';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAdminDashboardQuery } from '../../queries/useAdminDashboardQuery.js';

function formatAmount(locale, total) {
  return new Intl.NumberFormat(locale).format(total);
}

export default function AdminDashboardOverviewContent() {
  const { t, i18n } = useTranslation();
  const { data, isPending, isError, refetch } = useAdminDashboardQuery();

  if (isError) {
    return (
      <Section spacing="default">
        <PageHeader title={t('admin.dashboard.heading')} />
        <ErrorState
          title={t('admin.dashboard.error.title')}
          retryLabel={t('admin.dashboard.error.retry')}
          onRetry={refetch}
        />
      </Section>
    );
  }

  const counts = data?.counts;
  const pendingActions = data?.pending_actions;
  const bookingValueByCurrency = data?.booking_value_by_currency ?? [];
  const bookingsByDay = data?.bookings_by_day ?? [];
  const recentActivity = data?.recent_activity ?? [];

  return (
    <Section spacing="default">
      <PageHeader title={t('admin.dashboard.heading')} />

      <Stack gap="8">
        <Grid columns={3} gap="4">
          <StatCard
            label={t('admin.dashboard.stats.users')}
            value={counts?.users}
            variant="neutral"
            isLoading={isPending}
          />
          <StatCard
            label={t('admin.dashboard.stats.partners')}
            value={counts?.partners}
            variant="neutral"
            isLoading={isPending}
          />
          <StatCard
            label={t('admin.dashboard.stats.listings')}
            value={counts?.listings}
            variant="neutral"
            isLoading={isPending}
          />
          <StatCard
            label={t('admin.dashboard.stats.publishedListings')}
            value={counts?.published_listings}
            variant="success"
            isLoading={isPending}
          />
          <StatCard
            label={t('admin.dashboard.stats.bookings')}
            value={counts?.bookings}
            variant="info"
            isLoading={isPending}
          />
          <StatCard
            label={t('admin.dashboard.stats.completedBookings')}
            value={counts?.completed_bookings}
            variant="success"
            isLoading={isPending}
          />
        </Grid>

        <Card as="div" padding="lg">
          <Stack gap="3">
            <h2>{t('admin.dashboard.pendingActions.heading')}</h2>
            <Grid columns={3} gap="4">
              <StatCard
                label={t('admin.dashboard.pendingActions.partners')}
                value={pendingActions?.pending_partners}
                variant="warning"
                isLoading={isPending}
              />
              <StatCard
                label={t('admin.dashboard.pendingActions.listings')}
                value={pendingActions?.pending_listings}
                variant="warning"
                isLoading={isPending}
              />
              <StatCard
                label={t('admin.dashboard.pendingActions.bookings')}
                value={pendingActions?.pending_bookings}
                variant="warning"
                isLoading={isPending}
              />
            </Grid>
          </Stack>
        </Card>

        <Grid columns={2} gap="4">
          <Card as="div" padding="lg">
            <Stack gap="3">
              <h2>{t('admin.dashboard.chart.heading')}</h2>
              {isPending ? (
                <Skeleton variant="rect" height={240} />
              ) : (
                <Chart
                  type="bar"
                  data={bookingsByDay}
                  xKey="day"
                  yKey="total"
                  height={240}
                />
              )}
            </Stack>
          </Card>

          <Card as="div" padding="lg">
            <Stack gap="3">
              <h2>{t('admin.dashboard.bookingValue.heading')}</h2>
              {isPending ? (
                <Skeleton variant="text" width="60%" />
              ) : (
                <Stack gap="2">
                  {bookingValueByCurrency.map((entry) => (
                    <Inline
                      key={entry.currency_code}
                      justify="space-between"
                      align="center"
                    >
                      <span>{entry.currency_code}</span>
                      <strong>
                        {formatAmount(i18n.language, entry.total)}
                      </strong>
                    </Inline>
                  ))}
                  <p>{t('admin.dashboard.bookingValue.note')}</p>
                </Stack>
              )}
            </Stack>
          </Card>
        </Grid>

        <Card as="div" padding="lg">
          <Stack gap="3">
            <h2>{t('admin.dashboard.recentActivity.heading')}</h2>
            {isPending && <Skeleton variant="text" width="80%" />}
            {!isPending && recentActivity.length === 0 && (
              <EmptyState title={t('admin.dashboard.recentActivity.empty')} />
            )}
            {!isPending && recentActivity.length > 0 && (
              <Stack gap="2">
                {recentActivity.map((entry, index) => (
                  <Inline
                    // eslint-disable-next-line react/no-array-index-key -- audit-log entries have no stable client-side id in this DTO
                    key={index}
                    justify="space-between"
                    align="center"
                  >
                    <span>
                      {entry.actor_name ??
                        t('admin.dashboard.recentActivity.systemActor')}{' '}
                      — {entry.action} ({entry.target_type} #{entry.target_id})
                    </span>
                    <span>
                      {new Intl.DateTimeFormat(i18n.language, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(entry.created_at))}
                    </span>
                  </Inline>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>
      </Stack>
    </Section>
  );
}
