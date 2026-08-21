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
 *
 * Partner reply: `partnerId` (the listing's own, passed by
 * `ListingReviewsSection`) is optional on purpose — every OTHER caller
 * of this component (none currently exist, but the prop must stay
 * backward-compatible) simply never shows the Reply/Edit/Delete
 * affordances. Visibility here is a convenience only — the real
 * authorization is server-side (`reviewService.js
 * #assertCanRespondToReview`); `canRespond` below just avoids showing a
 * control that would 403 on click. Matches OWNER/MANAGER, the same
 * trust tier `RESPOND_TO_REVIEWS` grants server-side.
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
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useListingReviewsQuery } from '../../queries/useListingReviewsQuery.js';
import { useReportReviewMutation } from '../../mutations/useReportReviewMutation.js';
import { useReplyToReviewMutation } from '../../mutations/useReplyToReviewMutation.js';
import { useDeleteReviewReplyMutation } from '../../mutations/useDeleteReviewReplyMutation.js';
import styles from './ReviewsList.module.scss';

const REPORT_REASON_CODES = ['SPAM', 'ABUSIVE', 'OFF_TOPIC', 'FAKE', 'OTHER'];
const RESPOND_ROLES = ['OWNER', 'MANAGER'];

function ReplyToReviewModal({
  isOpen,
  onClose,
  onSubmitReply,
  isSaving,
  initialValue = '',
}) {
  const { t } = useTranslation();
  const { control, handleSubmit, reset } = useForm({
    defaultValues: { response: initialValue ?? '' },
  });

  async function onSubmit(values) {
    const ok = await onSubmitReply(values.response);
    if (ok) reset();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('reviews.reply.title')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="4">
          <Controller
            name="response"
            control={control}
            rules={{ required: true, maxLength: 2000 }}
            render={({ field }) => (
              <Textarea
                label={t('reviews.reply.responseLabel')}
                rows={4}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...field}
              />
            )}
          />
          <Inline justify="flex-end">
            <Button type="submit" variant="primary" loading={isSaving}>
              {t('reviews.reply.submitAction')}
            </Button>
          </Inline>
        </Stack>
      </form>
    </Modal>
  );
}

ReplyToReviewModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmitReply: PropTypes.func.isRequired,
  isSaving: PropTypes.bool.isRequired,
  initialValue: PropTypes.string,
};

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

export default function ReviewsList({ listingId, partnerId = undefined }) {
  const { t, i18n } = useTranslation();
  const { isAuthenticated, partnerships } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [reportTarget, setReportTarget] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
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
  const replyMutation = useReplyToReviewMutation(listingId);
  const deleteReplyMutation = useDeleteReviewReplyMutation(listingId);

  const canRespond = useMemo(
    () =>
      isAuthenticated &&
      Boolean(partnerId) &&
      (partnerships ?? []).some(
        (membership) =>
          membership.partner_id === partnerId &&
          RESPOND_ROLES.includes(membership.role),
      ),
    [isAuthenticated, partnerId, partnerships],
  );

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

  async function handleSubmitReply(responseText) {
    try {
      await replyMutation.mutateAsync({
        id: replyTarget.id,
        response: responseText,
      });
      showToast(t('reviews.reply.success'), { variant: 'success' });
      setReplyTarget(null);
      return true;
    } catch {
      showToast(t('reviews.reply.error'), { variant: 'danger' });
      return false;
    }
  }

  async function handleDeleteReply(review) {
    const confirmed = await confirm({
      title: t('reviews.reply.deleteConfirmTitle'),
      description: t('reviews.reply.deleteConfirmDescription'),
      confirmLabel: t('reviews.reply.deleteAction'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await deleteReplyMutation.mutateAsync(review.id);
      showToast(t('reviews.reply.deleteSuccess'), { variant: 'success' });
    } catch {
      showToast(t('reviews.reply.error'), { variant: 'danger' });
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
              <Inline justify="flex-end" gap="2" wrap>
                {canRespond && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyTarget(review)}
                  >
                    {review.vendor_response
                      ? t('reviews.reply.editAction')
                      : t('reviews.reply.action')}
                  </Button>
                )}
                {canRespond && review.vendor_response && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteReply(review)}
                  >
                    {t('reviews.reply.deleteAction')}
                  </Button>
                )}
                {isAuthenticated && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReportTarget(review)}
                  >
                    {t('reviews.report.action')}
                  </Button>
                )}
              </Inline>
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
      {replyTarget && (
        <ReplyToReviewModal
          isOpen
          onClose={() => setReplyTarget(null)}
          onSubmitReply={(responseText) => handleSubmitReply(responseText)}
          isSaving={replyMutation.isPending}
          initialValue={replyTarget.vendor_response ?? ''}
        />
      )}
    </Stack>
  );
}

ReviewsList.propTypes = {
  listingId: PropTypes.number.isRequired,
  // Optional: only present when rendered on a listing detail page that
  // knows the listing's owning partner (see the header comment above).
  partnerId: PropTypes.number,
};
