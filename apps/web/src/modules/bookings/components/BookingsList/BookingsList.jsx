/**
 * BookingsList — loading/empty/error/pagination states for the "My
 * Bookings" list, mirroring `search`'s `SearchResults.jsx` exactly:
 * prop-driven, unaware of React Query — only a flat `bookings` array plus
 * a handful of booleans/callbacks.
 *
 * 2026 Customer Account redesign: groups the same flat, already-paginated
 * `bookings` array into Upcoming / Past / Cancelled sections (brief:
 * "Improve: upcoming / past / cancelled hierarchy") — a client-side
 * re-bucketing of data this component already received, not a new query
 * or a change to what `onLoadMore` fetches. `BookingCard` renders with
 * `variant="premium"` here only (this list is customer-only — see
 * `BookingCard.jsx`'s own header for why Partner's identical list stays
 * on the default variant).
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@desavii/ui/components/feedback-overlays';
import { Button } from '@desavii/ui/components/primitives';
import { Stack } from '@desavii/ui/components/layout';
import BookingCard from '../BookingCard/BookingCard.jsx';
import { toISODate } from '../../../listings/utils/reservationEstimate.js';
import styles from './BookingsList.module.scss';

const SKELETON_COUNT = 4;
const UPCOMING_STATUSES = ['PENDING_VENDOR', 'CONFIRMED'];
const CANCELLED_STATUSES = [
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_VENDOR',
  'REJECTED',
  'EXPIRED',
];

function groupBookings(bookings) {
  const today = toISODate(new Date());
  const upcoming = [];
  const past = [];
  const cancelled = [];

  bookings.forEach((booking) => {
    if (CANCELLED_STATUSES.includes(booking.status)) {
      cancelled.push(booking);
      return;
    }
    const isUpcoming =
      UPCOMING_STATUSES.includes(booking.status) &&
      booking.date_from &&
      booking.date_from >= today;
    if (isUpcoming) {
      upcoming.push(booking);
    } else {
      past.push(booking);
    }
  });

  return { upcoming, past, cancelled };
}

export default function BookingsList({
  bookings,
  isPending,
  isError,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupBookings(bookings), [bookings]);

  if (isPending) {
    return (
      <Stack gap="3">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          // Skeleton placeholders are positionally static, non-reorderable.
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={index} variant="rect" height={104} />
        ))}
      </Stack>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title={t('bookings.list.error.title')}
        retryLabel={t('bookings.list.error.retry')}
        onRetry={onRetry}
      />
    );
  }

  if (bookings.length === 0) {
    return (
      <EmptyState
        title={t('bookings.list.empty.title')}
        description={t('bookings.list.empty.description')}
      />
    );
  }

  const sections = [
    {
      id: 'upcoming',
      label: t('bookings.list.groups.upcoming'),
      items: groups.upcoming,
    },
    { id: 'past', label: t('bookings.list.groups.past'), items: groups.past },
    {
      id: 'cancelled',
      label: t('bookings.list.groups.cancelled'),
      items: groups.cancelled,
    },
  ].filter((section) => section.items.length > 0);

  return (
    <Stack gap="8">
      {sections.map((section) => (
        <Stack key={section.id} gap="3" as="div">
          <h2 className={styles.groupHeading}>{section.label}</h2>
          <Stack gap="3">
            {section.items.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                variant="premium"
              />
            ))}
          </Stack>
        </Stack>
      ))}
      {hasNextPage && (
        <div className={styles.loadMore}>
          <Button
            variant="secondary"
            onClick={onLoadMore}
            loading={isFetchingNextPage}
          >
            {t('bookings.list.loadMore')}
          </Button>
        </div>
      )}
    </Stack>
  );
}

BookingsList.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  bookings: PropTypes.arrayOf(PropTypes.object).isRequired,
  isPending: PropTypes.bool.isRequired,
  isError: PropTypes.bool.isRequired,
  onRetry: PropTypes.func.isRequired,
  hasNextPage: PropTypes.bool.isRequired,
  isFetchingNextPage: PropTypes.bool.isRequired,
  onLoadMore: PropTypes.func.isRequired,
};
