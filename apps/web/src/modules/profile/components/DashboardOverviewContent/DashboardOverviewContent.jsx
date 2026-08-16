/**
 * DashboardOverviewContent — `/:locale/account` (Customer Dashboard).
 * Reuses `bookings`'s `useMyBookingsQuery`/`BookingCard` entirely rather
 * than standing up a second bookings data path — this is the same "My
 * Trips" first page `BookingsPageContent` shows, just sliced/grouped
 * differently for an overview.
 *
 * KNOWN LIMITATION: quick stats and "upcoming" are derived from the
 * single most-recent page of bookings (`MY_BOOKINGS_LIMIT`, currently
 * 10), not a true lifetime aggregate — there is no `GET /bookings`
 * summary/count endpoint, and standing one up wasn't judged "genuinely
 * required" for this phase (see the Phase 8 report). A customer with
 * more than one page of bookings may have older upcoming trips this
 * view doesn't surface; the labels below are phrased to stay honest
 * about that ("from your recent bookings"), not implying a lifetime
 * total.
 *
 * "Upcoming"/"Recent" sections are each wrapped in the shared `Card`
 * primitive (Phase 10 redesign) as a widget panel — visual grouping
 * only, no change to the data these sections already showed.
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, Stack, Grid, Inline } from '@travelhub/ui/components/layout';
import { StatCard } from '@travelhub/ui/components/dashboard';
import { Card } from '@travelhub/ui/components/primitives';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useMyBookingsQuery, BookingCard } from '../../../bookings/index.js';
import { toISODate } from '../../../listings/utils/reservationEstimate.js';
import { RecommendationsSection } from '../../../ai/index.js';

const ACTIVE_STATUSES = ['PENDING_VENDOR', 'CONFIRMED'];
const SECTION_LIMIT = 5;

function BookingCardListSkeleton() {
  return (
    <Stack gap="3">
      {Array.from({ length: 3 }, (_, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <Skeleton key={index} variant="rect" height={104} />
      ))}
    </Stack>
  );
}

export default function DashboardOverviewContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isPending, isError, refetch } = useMyBookingsQuery();

  const recentBookings = data?.pages?.[0]?.results ?? [];
  const hasAnyBookings = recentBookings.length > 0;

  const today = toISODate(new Date());
  const upcomingBookings = recentBookings
    .filter(
      (booking) =>
        ACTIVE_STATUSES.includes(booking.status) &&
        booking.date_from &&
        booking.date_from >= today,
    )
    .sort((a, b) => a.date_from.localeCompare(b.date_from));
  const pendingCount = recentBookings.filter(
    (booking) => booking.status === 'PENDING_VENDOR',
  ).length;

  return (
    <Section spacing="default">
      <PageHeader title={t('dashboard.greeting', { name: user.first_name })} />

      {isError ? (
        <ErrorState
          title={t('dashboard.error.title')}
          retryLabel={t('dashboard.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="8">
          <Grid columns={3} gap="4">
            <StatCard
              label={t('dashboard.stats.upcoming')}
              value={upcomingBookings.length}
              variant="info"
              isLoading={isPending}
            />
            <StatCard
              label={t('dashboard.stats.pending')}
              value={pendingCount}
              variant="warning"
              isLoading={isPending}
            />
            <StatCard
              label={t('dashboard.stats.recent')}
              value={recentBookings.length}
              variant="neutral"
              isLoading={isPending}
            />
          </Grid>

          <Card as="div" padding="lg">
            <Stack gap="3">
              <Inline justify="space-between" align="center">
                <h2>{t('dashboard.upcoming.heading')}</h2>
              </Inline>
              {isPending && <BookingCardListSkeleton />}
              {!isPending && upcomingBookings.length === 0 && (
                <EmptyState
                  title={t('dashboard.upcoming.emptyTitle')}
                  description={t('dashboard.upcoming.emptyDescription')}
                />
              )}
              {!isPending && upcomingBookings.length > 0 && (
                <Stack gap="3">
                  {upcomingBookings.slice(0, SECTION_LIMIT).map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>

          <Card as="div" padding="lg">
            <Stack gap="3">
              <Inline justify="space-between" align="center">
                <h2>{t('dashboard.recent.heading')}</h2>
                {hasAnyBookings && (
                  <RouterLink href={`/${locale}/account/bookings`}>
                    {t('dashboard.recent.viewAll')}
                  </RouterLink>
                )}
              </Inline>
              {isPending && <BookingCardListSkeleton />}
              {!isPending && !hasAnyBookings && (
                <EmptyState
                  title={t('dashboard.recent.emptyTitle')}
                  description={t('dashboard.recent.emptyDescription')}
                  actionLabel={t('dashboard.recent.emptyAction')}
                  onAction={() => navigate(`/${locale}/search`)}
                />
              )}
              {!isPending && hasAnyBookings && (
                <Stack gap="3">
                  {recentBookings.slice(0, SECTION_LIMIT).map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>

          <RecommendationsSection />
        </Stack>
      )}
    </Section>
  );
}
