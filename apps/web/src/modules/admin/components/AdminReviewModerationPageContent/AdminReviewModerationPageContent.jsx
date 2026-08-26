/**
 * AdminReviewModerationPageContent — `/:locale/admin/reviews` (P1.5,
 * Master Roadmap: Review Trust & Safety). Same orchestrator shape as
 * `AdminListingModerationPageContent`: URL-synced moderationStatus/
 * hasReports filters (`useAdminListFilters`) over the
 * `useAdminReviewsQuery` infinite query, rendered via the shared
 * `DataTable` primitive. Defaults to `moderationStatus=` (all) +
 * `hasReports=true` so landing on the page shows the actual queue that
 * needs attention — reviews someone flagged — not the full, mostly
 * already-fine review corpus.
 *
 * Approve needs no extra input (`useConfirm()`); Reject collects an
 * optional free-text reason via a small local controlled `Modal`, same
 * "`useConfirm()` can't host a controlled textarea" reasoning
 * `AdminListingModerationPageContent.jsx`'s own header comment explains.
 * A third, read-only "View reports" dialog (fetched on demand via
 * `useAdminReviewDetailQuery`) shows who reported a review and why.
 */

import { useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Select, Textarea } from '@desavii/ui/components/form-controls';
import { Button, Badge } from '@desavii/ui/components/primitives';
import { DataTable } from '@desavii/ui/components/dashboard';
import {
  Modal,
  ErrorState,
  Skeleton,
} from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useAdminListFilters } from '../../hooks/useAdminListFilters.js';
import { useAdminReviewsQuery } from '../../queries/useAdminReviewsQuery.js';
import { useAdminReviewDetailQuery } from '../../queries/useAdminReviewDetailQuery.js';
import { useUpdateReviewModerationStatusMutation } from '../../mutations/useUpdateReviewModerationStatusMutation.js';

const MODERATION_BADGE_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FLAGGED: 'danger',
};

const DEFAULT_FILTERS = { moderationStatus: '', hasReports: 'true' };

function ReviewReportsModal({ reviewId, onClose, t }) {
  const { data: review, isPending } = useAdminReviewDetailQuery(reviewId);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('admin.reviewModeration.reportsDialogTitle')}
    >
      {isPending ? (
        <Skeleton variant="text" width="60%" />
      ) : (
        <Stack gap="3">
          {(review?.reports ?? []).map((report) => (
            <Stack key={report.id} gap="1">
              <strong>{report.reason_name}</strong>
              {report.details && <p>{report.details}</p>}
            </Stack>
          ))}
        </Stack>
      )}
    </Modal>
  );
}

ReviewReportsModal.propTypes = {
  reviewId: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default function AdminReviewModerationPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const { filters, updateFilters } = useAdminListFilters(DEFAULT_FILTERS);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [reportsTargetId, setReportsTargetId] = useState(null);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminReviewsQuery({
    moderationStatus: filters.moderationStatus,
    hasReports: filters.hasReports === 'true',
  });
  const updateModerationMutation = useUpdateReviewModerationStatusMutation();

  const reviews = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const moderationOptions = [
    { value: '', label: t('admin.reviewModeration.filters.moderationAll') },
    {
      value: 'PENDING',
      label: t('admin.reviewModeration.moderationStatus.PENDING'),
    },
    {
      value: 'APPROVED',
      label: t('admin.reviewModeration.moderationStatus.APPROVED'),
    },
    {
      value: 'REJECTED',
      label: t('admin.reviewModeration.moderationStatus.REJECTED'),
    },
    {
      value: 'FLAGGED',
      label: t('admin.reviewModeration.moderationStatus.FLAGGED'),
    },
  ];
  const hasReportsOptions = [
    { value: 'true', label: t('admin.reviewModeration.filters.reportedOnly') },
    { value: 'false', label: t('admin.reviewModeration.filters.allReviews') },
  ];

  async function handleApprove(review) {
    const confirmed = await confirm({
      title: t('admin.reviewModeration.approveConfirmTitle'),
      description: t('admin.reviewModeration.approveConfirmDescription'),
      confirmLabel: t('admin.reviewModeration.approveAction'),
      cancelLabel: t('common.cancel'),
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      await updateModerationMutation.mutateAsync({
        id: review.id,
        status: 'APPROVED',
      });
      showToast(t('admin.reviewModeration.approveSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.reviewModeration.statusError'), {
        variant: 'danger',
      });
    }
  }

  function openRejectDialog(review) {
    setRejectNotes('');
    setRejectTarget(review);
  }

  const closeRejectDialog = useCallback(() => setRejectTarget(null), []);

  async function handleConfirmReject() {
    try {
      await updateModerationMutation.mutateAsync({
        id: rejectTarget.id,
        status: 'REJECTED',
        notes: rejectNotes.trim() || undefined,
      });
      showToast(t('admin.reviewModeration.rejectSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.reviewModeration.statusError'), {
        variant: 'danger',
      });
    } finally {
      setRejectTarget(null);
    }
  }

  const columns = [
    {
      key: 'listing',
      header: t('admin.reviewModeration.table.listing'),
      render: (review) => review.listing_title ?? '—',
    },
    {
      key: 'customer',
      header: t('admin.reviewModeration.table.customer'),
      render: (review) => review.customer_display_name,
    },
    {
      key: 'rating',
      header: t('admin.reviewModeration.table.rating'),
      render: (review) => review.rating,
    },
    {
      key: 'content',
      header: t('admin.reviewModeration.table.content'),
      render: (review) => review.content ?? '—',
    },
    {
      key: 'status',
      header: t('admin.reviewModeration.table.status'),
      render: (review) => (
        <Badge
          variant={MODERATION_BADGE_VARIANT[review.status] ?? 'neutral'}
          size="sm"
          label={t(`admin.reviewModeration.moderationStatus.${review.status}`, {
            defaultValue: review.status,
          })}
        />
      ),
    },
    {
      key: 'reports',
      header: t('admin.reviewModeration.table.reports'),
      render: (review) =>
        review.report_count > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReportsTargetId(review.id)}
          >
            {t('admin.reviewModeration.viewReports', {
              count: review.report_count,
            })}
          </Button>
        ) : (
          '—'
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (review) => (
        <Inline gap="2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleApprove(review)}
            loading={
              updateModerationMutation.isPending &&
              updateModerationMutation.variables?.id === review.id &&
              updateModerationMutation.variables?.status === 'APPROVED'
            }
          >
            {t('admin.reviewModeration.approveAction')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => openRejectDialog(review)}
          >
            {t('admin.reviewModeration.rejectAction')}
          </Button>
        </Inline>
      ),
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.reviewModeration.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.reviewModeration.heading'),
            href: `/${locale}/admin/reviews`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.reviewModeration.error.title')}
          retryLabel={t('admin.reviewModeration.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <Inline gap="3" wrap>
            <Select
              ariaLabel={t('admin.reviewModeration.filters.moderationLabel')}
              options={moderationOptions}
              value={filters.moderationStatus}
              onChange={(value) => updateFilters({ moderationStatus: value })}
            />
            <Select
              ariaLabel={t('admin.reviewModeration.filters.reportedLabel')}
              options={hasReportsOptions}
              value={filters.hasReports}
              onChange={(value) => updateFilters({ hasReports: value })}
            />
          </Inline>

          <DataTable
            columns={columns}
            rows={reviews}
            isLoading={isPending}
            emptyTitle={t('admin.reviewModeration.empty.title')}
            emptyDescription={t('admin.reviewModeration.empty.description')}
            hasMore={Boolean(hasNextPage)}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            loadMoreLabel={t('admin.reviewModeration.loadMore')}
          />
        </Stack>
      )}

      {rejectTarget && (
        <Modal
          isOpen
          onClose={closeRejectDialog}
          title={t('admin.reviewModeration.rejectDialogTitle')}
          size="sm"
          footer={
            <Inline gap="3" justify="flex-end">
              <Button variant="ghost" onClick={closeRejectDialog}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirmReject()}
                loading={updateModerationMutation.isPending}
              >
                {t('admin.reviewModeration.rejectAction')}
              </Button>
            </Inline>
          }
        >
          <Stack gap="3">
            <span>{t('admin.reviewModeration.rejectDialogDescription')}</span>
            <Textarea
              label={t('admin.reviewModeration.notesLabel')}
              placeholder={t('admin.reviewModeration.notesPlaceholder')}
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={4}
            />
          </Stack>
        </Modal>
      )}

      {reportsTargetId && (
        <ReviewReportsModal
          reviewId={reportsTargetId}
          onClose={() => setReportsTargetId(null)}
          t={t}
        />
      )}
    </Section>
  );
}
