/**
 * AdminListingModerationPageContent — `/:locale/admin/listings` (Listing
 * Moderation). Orchestrator, same shape as `AdminPartnersPageContent`:
 * URL-synced keyword/moderationStatus/status filters
 * (`useAdminListFilters`) over the `useAdminListingsQuery` infinite
 * query, rendered via the shared `DataTable` primitive. Defaults to
 * `moderationStatus=PENDING` so landing on the page shows the actual
 * moderation queue, not every listing ever created.
 *
 * Approve needs no extra input, so it reuses the shared `useConfirm()`
 * modal exactly like every other admin toggle. Reject collects an
 * optional free-text reason (`listings.moderation_notes`, Stage 11.3's
 * migration) — `useConfirm()`'s modal only ever resolves a boolean, so
 * it can't host a controlled textarea (the modal's own React tree is
 * frozen at the moment `confirm()` is called, meaning a textarea inside
 * it would not re-render as the admin types); a small local `Modal`
 * rendered directly in this component's own tree is used instead, so
 * the notes field stays fully controlled.
 */

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import {
  Input,
  Select,
  Textarea,
} from '@travelhub/ui/components/form-controls';
import { Button, Badge } from '@travelhub/ui/components/primitives';
import { DataTable } from '@travelhub/ui/components/dashboard';
import { Modal, ErrorState } from '@travelhub/ui/components/feedback-overlays';
import { Search } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useAdminListFilters } from '../../hooks/useAdminListFilters.js';
import { useAdminListingsQuery } from '../../queries/useAdminListingsQuery.js';
import { useUpdateListingModerationStatusMutation } from '../../mutations/useUpdateListingModerationStatusMutation.js';

const MODERATION_BADGE_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FLAGGED: 'danger',
};

const STATUS_BADGE_VARIANT = {
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  PUBLISHED: 'success',
  UNPUBLISHED: 'neutral',
  ARCHIVED: 'neutral',
};

const DEFAULT_FILTERS = {
  keyword: '',
  moderationStatus: 'PENDING',
  status: '',
};

export default function AdminListingModerationPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const confirm = useConfirm();
  const { showToast } = useToast();

  const { filters, updateFilters } = useAdminListFilters(DEFAULT_FILTERS);
  const [keywordText, setKeywordText] = useState(filters.keyword);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminListingsQuery({
    keyword: filters.keyword,
    moderationStatus: filters.moderationStatus,
    status: filters.status,
  });
  const updateModerationMutation = useUpdateListingModerationStatusMutation();

  const listings = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const moderationOptions = [
    { value: '', label: t('admin.listingModeration.filters.moderationAll') },
    {
      value: 'PENDING',
      label: t('admin.listingModeration.moderationStatus.PENDING'),
    },
    {
      value: 'APPROVED',
      label: t('admin.listingModeration.moderationStatus.APPROVED'),
    },
    {
      value: 'REJECTED',
      label: t('admin.listingModeration.moderationStatus.REJECTED'),
    },
    {
      value: 'FLAGGED',
      label: t('admin.listingModeration.moderationStatus.FLAGGED'),
    },
  ];
  const statusOptions = [
    { value: '', label: t('admin.listingModeration.filters.statusAll') },
    { value: 'DRAFT', label: t('admin.listingModeration.status.DRAFT') },
    {
      value: 'PENDING_REVIEW',
      label: t('admin.listingModeration.status.PENDING_REVIEW'),
    },
    {
      value: 'PUBLISHED',
      label: t('admin.listingModeration.status.PUBLISHED'),
    },
    {
      value: 'UNPUBLISHED',
      label: t('admin.listingModeration.status.UNPUBLISHED'),
    },
    { value: 'ARCHIVED', label: t('admin.listingModeration.status.ARCHIVED') },
  ];

  async function handleApprove(listing) {
    const confirmed = await confirm({
      title: t('admin.listingModeration.approveConfirmTitle', {
        title: listing.title,
      }),
      description: t('admin.listingModeration.approveConfirmDescription'),
      confirmLabel: t('admin.listingModeration.approveAction'),
      cancelLabel: t('common.cancel'),
      variant: 'primary',
    });
    if (!confirmed) return;

    try {
      await updateModerationMutation.mutateAsync({
        id: listing.id,
        status: 'APPROVED',
      });
      showToast(t('admin.listingModeration.approveSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.listingModeration.statusError'), {
        variant: 'danger',
      });
    }
  }

  function openRejectDialog(listing) {
    setRejectNotes('');
    setRejectTarget(listing);
  }

  // A stable reference matters here, not just style: `useFocusTrap`'s
  // effect depends on `onClose`, so a fresh inline arrow on every render
  // (e.g. from the notes textarea's own keystroke-driven re-renders)
  // would tear the keydown listener + focus-restore effect down and
  // rebuild it on every keystroke, yanking focus out of the textarea
  // mid-type.
  const closeRejectDialog = useCallback(() => setRejectTarget(null), []);

  async function handleConfirmReject() {
    try {
      await updateModerationMutation.mutateAsync({
        id: rejectTarget.id,
        status: 'REJECTED',
        notes: rejectNotes.trim() || undefined,
      });
      showToast(t('admin.listingModeration.rejectSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.listingModeration.statusError'), {
        variant: 'danger',
      });
    } finally {
      setRejectTarget(null);
    }
  }

  const columns = [
    {
      key: 'title',
      header: t('admin.listingModeration.table.title'),
      render: (listing) => listing.title ?? '—',
    },
    {
      key: 'partner',
      header: t('admin.listingModeration.table.partner'),
      render: (listing) => listing.partner_display_name,
    },
    {
      key: 'status',
      header: t('admin.listingModeration.table.status'),
      render: (listing) => (
        <Badge
          variant={STATUS_BADGE_VARIANT[listing.status] ?? 'neutral'}
          size="sm"
          label={t(`admin.listingModeration.status.${listing.status}`, {
            defaultValue: listing.status,
          })}
        />
      ),
    },
    {
      key: 'moderation',
      header: t('admin.listingModeration.table.moderation'),
      render: (listing) => (
        <Badge
          variant={
            MODERATION_BADGE_VARIANT[listing.moderation_status] ?? 'neutral'
          }
          size="sm"
          label={t(
            `admin.listingModeration.moderationStatus.${listing.moderation_status}`,
            { defaultValue: listing.moderation_status },
          )}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (listing) => (
        <Inline gap="2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleApprove(listing)}
            loading={
              updateModerationMutation.isPending &&
              updateModerationMutation.variables?.id === listing.id &&
              updateModerationMutation.variables?.status === 'APPROVED'
            }
          >
            {t('admin.listingModeration.approveAction')}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => openRejectDialog(listing)}
          >
            {t('admin.listingModeration.rejectAction')}
          </Button>
        </Inline>
      ),
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.listingModeration.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.listingModeration.heading'),
            href: `/${locale}/admin/listings`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.listingModeration.error.title')}
          retryLabel={t('admin.listingModeration.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <Inline gap="3" wrap>
            <Input
              aria-label={t('admin.listingModeration.filters.keywordLabel')}
              placeholder={t(
                'admin.listingModeration.filters.keywordPlaceholder',
              )}
              value={keywordText}
              onChange={(event) => setKeywordText(event.target.value)}
              onBlur={() => updateFilters({ keyword: keywordText })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  updateFilters({ keyword: keywordText });
                }
              }}
              iconLeft={<Search size={18} aria-hidden="true" />}
            />
            <Select
              ariaLabel={t('admin.listingModeration.filters.moderationLabel')}
              options={moderationOptions}
              value={filters.moderationStatus}
              onChange={(value) => updateFilters({ moderationStatus: value })}
            />
            <Select
              ariaLabel={t('admin.listingModeration.filters.statusLabel')}
              options={statusOptions}
              value={filters.status}
              onChange={(value) => updateFilters({ status: value })}
            />
          </Inline>

          <DataTable
            columns={columns}
            rows={listings}
            isLoading={isPending}
            emptyTitle={t('admin.listingModeration.empty.title')}
            emptyDescription={t('admin.listingModeration.empty.description')}
            hasMore={Boolean(hasNextPage)}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            loadMoreLabel={t('admin.listingModeration.loadMore')}
          />
        </Stack>
      )}

      {rejectTarget && (
        <Modal
          isOpen
          onClose={closeRejectDialog}
          title={t('admin.listingModeration.rejectDialogTitle', {
            title: rejectTarget.title,
          })}
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
                {t('admin.listingModeration.rejectAction')}
              </Button>
            </Inline>
          }
        >
          <Stack gap="3">
            <span>{t('admin.listingModeration.rejectDialogDescription')}</span>
            <Textarea
              label={t('admin.listingModeration.notesLabel')}
              placeholder={t('admin.listingModeration.notesPlaceholder')}
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              rows={4}
            />
          </Stack>
        </Modal>
      )}
    </Section>
  );
}
