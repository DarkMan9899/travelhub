/**
 * ReviewsList — a listing's approved reviews: a `RatingStars` summary
 * header (from `GET /reviews`'s `meta.rating_average`/`review_count`,
 * additive alongside the cursor-pagination `meta` every other list
 * endpoint already returns) plus a "Load more" list of review cards,
 * same triad (Skeleton/EmptyState/ErrorState) every other list in this
 * codebase uses.
 *
 * P1.5 (Master Roadmap, Review Trust & Safety): also renders
 * `vendor_response` (the DTO has returned it since Phase 12, but no UI
 * ever displayed it — a real, previously-unnoticed gap, not new scope),
 * and adds a "Report" action per review, same `isAuthenticated` ?
 * render : null gate `FavoriteButton.jsx` already establishes for a
 * logged-out visitor acting on public content.
 */

import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import { Card, Button } from '@travelhub/ui/components/primitives';
import { RatingStars } from '@travelhub/ui/components/data-display';
import { Select, Textarea } from '@travelhub/ui/components/form-controls';
import {
  Skeleton,
  EmptyState,
  ErrorState,
  Spinner,
  Modal,
} from '@travelhub/ui/components/feedback-overlays';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useListingReviewsQuery } from '../../queries/useListingReviewsQuery.js';
import { useReportReviewMutation } from '../../mutations/useReportReviewMutation.js';
import styles from './ReviewsList.module.scss';

const REPORT_REASON_CODES = ['SPAM', 'ABUSIVE', 'OFF_TOPIC', 'FAKE', 'OTHER'];

function ReportReviewModal({ isOpen, onClose, onSubmitReport, isSaving }) {
  const { t } = useTranslation();
  const { control, handleSubmit, reset } = useForm({
    defaultValues: { reasonCode: 'SPAM', details: '' },
  });

  async function onSubmit(values) {
    const ok = await onSubmitReport(values);
    if (ok) reset();
  }

  const reasonOptions = REPORT_REASON_CODES.map((code) => ({
    value: code,
    label: t(`reviews.report.reasons.${code}`),
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('reviews.report.title')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="4">
          <Controller
            name="reasonCode"
            control={control}
            render={({ field }) => (
              <Select
                label={t('reviews.report.reasonLabel')}
                options={reasonOptions}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            name="details"
            control={control}
            render={({ field }) => (
              <Textarea
                label={t('reviews.report.detailsLabel')}
                rows={3}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
          <Inline justify="flex-end">
            <Button type="submit" variant="primary" loading={isSaving}>
              {t('reviews.report.submitAction')}
            </Button>
          </Inline>
        </Stack>
      </form>
    </Modal>
  );
}

ReportReviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmitReport: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
};

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
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [reportTarget, setReportTarget] = useState(null);
  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useListingReviewsQuery(listingId);
  const reportMutation = useReportReviewMutation();

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

  async function handleSubmitReport(values) {
    try {
      await reportMutation.mutateAsync({ id: reportTarget.id, ...values });
      showToast(t('reviews.report.success'), { variant: 'success' });
      setReportTarget(null);
      return true;
    } catch (err) {
      showToast(
        err.code === 'CONFLICT'
          ? t('reviews.report.alreadyReported')
          : t('reviews.report.error'),
        { variant: 'danger' },
      );
      return false;
    }
  }

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
              {review.vendor_response && (
                <Card as="div" padding="md" className={styles.vendorResponse}>
                  <Stack gap="1">
                    <strong>{t('reviews.vendorResponseLabel')}</strong>
                    <p>{review.vendor_response}</p>
                  </Stack>
                </Card>
              )}
              {isAuthenticated && (
                <Inline justify="flex-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReportTarget(review)}
                  >
                    {t('reviews.report.action')}
                  </Button>
                </Inline>
              )}
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
      {reportTarget && (
        <ReportReviewModal
          isOpen
          onClose={() => setReportTarget(null)}
          onSubmitReport={(values) => handleSubmitReport(values)}
          isSaving={reportMutation.isPending}
        />
      )}
    </Stack>
  );
}

ReviewsList.propTypes = {
  listingId: PropTypes.number.isRequired,
};
