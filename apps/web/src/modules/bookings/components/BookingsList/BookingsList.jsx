/**
 * BookingsList — loading/empty/error/pagination states for the "My
 * Bookings" list, mirroring `search`'s `SearchResults.jsx` exactly:
 * prop-driven, unaware of React Query — only a flat `bookings` array plus
 * a handful of booleans/callbacks.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { Button } from '@travelhub/ui/components/primitives';
import { Stack } from '@travelhub/ui/components/layout';
import BookingCard from '../BookingCard/BookingCard.jsx';
import styles from './BookingsList.module.scss';

const SKELETON_COUNT = 4;

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

  return (
    <Stack gap="3">
      {bookings.map((booking) => (
        <BookingCard key={booking.id} booking={booking} />
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
