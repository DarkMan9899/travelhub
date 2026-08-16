/**
 * ReviewsList — a listing's approved reviews: a `RatingStars` summary
 * header (from `GET /reviews`'s `meta.rating_average`/`review_count`,
 * additive alongside the cursor-pagination `meta` every other list
 * endpoint already returns) plus a "Load more" list of review cards,
 * same triad (Skeleton/EmptyState/ErrorState) every other list in this
 * codebase uses.
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import { Card, Button } from '@travelhub/ui/components/primitives';
import { RatingStars } from '@travelhub/ui/components/data-display';
import {
  Skeleton,
  EmptyState,
  ErrorState,
  Spinner,
} from '@travelhub/ui/components/feedback-overlays';
import { useListingReviewsQuery } from '../../queries/useListingReviewsQuery.js';
import styles from './ReviewsList.module.scss';

function ReviewsListSkeleton() {
  return (
    <Stack gap="3">
      {Array.from({ length: 3 }, (_, index) => (
        // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
        <Skeleton key={index} variant="rect" height={96} />
      ))}
    </Stack>
  );
}

export default function ReviewsList({ listingId }) {
  const { t, i18n } = useTranslation();
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useListingReviewsQuery(listingId);

  const reviews = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );
  const summaryMeta = data?.pages[0]?.meta;
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
      }),
    [i18n.language],
  );

  if (isError) {
    return (
      <ErrorState
        title={t('reviews.list.errorTitle')}
        retryLabel={t('reviews.list.errorRetry')}
        onRetry={() => refetch()}
      />
    );
  }

  if (isPending) return <ReviewsListSkeleton />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        title={t('reviews.list.emptyTitle')}
        description={t('reviews.list.emptyDescription')}
      />
    );
  }

  return (
    <Stack gap="4">
      {typeof summaryMeta?.rating_average === 'number' && (
        <RatingStars
          value={summaryMeta.rating_average}
          reviewCount={summaryMeta.review_count}
        />
      )}
      <Stack gap="3">
        {reviews.map((review) => (
          <Card key={review.id} as="div" padding="lg">
            <Stack gap="2">
              <Inline justify="space-between" align="center">
                <strong>{review.customer_display_name}</strong>
                <span className={styles.date}>
                  {dateFormatter.format(new Date(review.created_at))}
                </span>
              </Inline>
              <RatingStars value={review.rating} size="sm" />
              {review.title && (
                <p className={styles.reviewTitle}>{review.title}</p>
              )}
              {review.content && <p>{review.content}</p>}
            </Stack>
          </Card>
        ))}
      </Stack>
      {hasNextPage && (
        <Button
          variant="ghost"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? (
            <Spinner size="sm" />
          ) : (
            t('reviews.list.loadMore')
          )}
        </Button>
      )}
    </Stack>
  );
}

ReviewsList.propTypes = {
  listingId: PropTypes.number.isRequired,
};
