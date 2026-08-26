/**
 * AdminPartnersPageContent — `/:locale/admin/partners` (Partner
 * Management). Orchestrator, same shape as `AdminUsersPageContent`:
 * URL-synced keyword/verification/moderation filters
 * (`useAdminListFilters`) over the `useAdminPartnersQuery` infinite
 * query, rendered via the shared `DataTable` primitive.
 *
 * The list's own inline row action is the moderation toggle (Suspend/
 * Restore — a partner's public-visibility switch), matching the Users
 * list's "act from the list, don't force a detour" convenience.
 * Verification decisions (Approve/Reject) are more deliberate and stay
 * on the detail page only, where the admin can see the partner's full
 * context first.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Input, Select } from '@desavii/ui/components/form-controls';
import { Button, Badge } from '@desavii/ui/components/primitives';
import { DataTable } from '@desavii/ui/components/dashboard';
import { ErrorState } from '@desavii/ui/components/feedback-overlays';
import { Search } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useAdminListFilters } from '../../hooks/useAdminListFilters.js';
import { useAdminPartnersQuery } from '../../queries/useAdminPartnersQuery.js';
import { useUpdatePartnerModerationStatusMutation } from '../../mutations/useUpdatePartnerModerationStatusMutation.js';

const VERIFICATION_BADGE_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const MODERATION_BADGE_VARIANT = {
  APPROVED: 'success',
  FLAGGED: 'danger',
};

const DEFAULT_FILTERS = {
  keyword: '',
  verificationStatus: '',
  moderationStatus: '',
};

export default function AdminPartnersPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { permissions } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const canModerate = permissions.includes('partner.moderate');

  const { filters, updateFilters } = useAdminListFilters(DEFAULT_FILTERS);
  const [keywordText, setKeywordText] = useState(filters.keyword);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminPartnersQuery({
    keyword: filters.keyword,
    verificationStatus: filters.verificationStatus,
    moderationStatus: filters.moderationStatus,
  });
  const updateModerationMutation = useUpdatePartnerModerationStatusMutation();

  const partners = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const verificationOptions = [
    { value: '', label: t('admin.partners.filters.verificationAll') },
    { value: 'PENDING', label: t('admin.partners.verificationStatus.PENDING') },
    {
      value: 'APPROVED',
      label: t('admin.partners.verificationStatus.APPROVED'),
    },
    {
      value: 'REJECTED',
      label: t('admin.partners.verificationStatus.REJECTED'),
    },
  ];
  const moderationOptions = [
    { value: '', label: t('admin.partners.filters.moderationAll') },
    { value: 'APPROVED', label: t('admin.partners.moderationStatus.APPROVED') },
    { value: 'FLAGGED', label: t('admin.partners.moderationStatus.FLAGGED') },
  ];

  async function handleToggleModeration(partner) {
    const nextStatus =
      partner.moderation_status === 'FLAGGED' ? 'APPROVED' : 'FLAGGED';
    const confirmed = await confirm({
      title: t(
        nextStatus === 'FLAGGED'
          ? 'admin.partners.suspendConfirmTitle'
          : 'admin.partners.restoreConfirmTitle',
        { name: partner.display_name },
      ),
      description: t(
        nextStatus === 'FLAGGED'
          ? 'admin.partners.suspendConfirmDescription'
          : 'admin.partners.restoreConfirmDescription',
      ),
      confirmLabel: t(
        nextStatus === 'FLAGGED'
          ? 'admin.partners.suspendConfirmAction'
          : 'admin.partners.restoreConfirmAction',
      ),
      cancelLabel: t('common.cancel'),
      variant: nextStatus === 'FLAGGED' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    try {
      await updateModerationMutation.mutateAsync({
        id: partner.id,
        status: nextStatus,
      });
      showToast(
        t(
          nextStatus === 'FLAGGED'
            ? 'admin.partners.suspendSuccess'
            : 'admin.partners.restoreSuccess',
        ),
        { variant: 'success' },
      );
    } catch {
      showToast(t('admin.partners.statusError'), { variant: 'danger' });
    }
  }

  const columns = [
    {
      key: 'name',
      header: t('admin.partners.table.name'),
      render: (partner) => (
        <RouterLink href={`/${locale}/admin/partners/${partner.id}`}>
          {partner.display_name}
        </RouterLink>
      ),
    },
    { key: 'email', header: t('admin.partners.table.email') },
    {
      key: 'verification',
      header: t('admin.partners.table.verification'),
      render: (partner) => (
        <Badge
          variant={
            VERIFICATION_BADGE_VARIANT[partner.verification_status] ?? 'neutral'
          }
          size="sm"
          label={t(
            `admin.partners.verificationStatus.${partner.verification_status}`,
            { defaultValue: partner.verification_status },
          )}
        />
      ),
    },
    {
      key: 'moderation',
      header: t('admin.partners.table.moderation'),
      render: (partner) => (
        <Badge
          variant={
            MODERATION_BADGE_VARIANT[partner.moderation_status] ?? 'neutral'
          }
          size="sm"
          label={t(
            `admin.partners.moderationStatus.${partner.moderation_status}`,
            { defaultValue: partner.moderation_status },
          )}
        />
      ),
    },
    { key: 'listings', header: t('admin.partners.table.listings') },
    {
      key: 'actions',
      header: '',
      render: (partner) =>
        canModerate ? (
          <Button
            variant={
              partner.moderation_status === 'FLAGGED'
                ? 'primary'
                : 'destructive'
            }
            size="sm"
            onClick={() => handleToggleModeration(partner)}
            loading={
              updateModerationMutation.isPending &&
              updateModerationMutation.variables?.id === partner.id
            }
          >
            {t(
              partner.moderation_status === 'FLAGGED'
                ? 'admin.partners.restoreConfirmAction'
                : 'admin.partners.suspendConfirmAction',
            )}
          </Button>
        ) : null,
    },
  ];

  const rows = partners.map((partner) => ({
    ...partner,
    listings: partner.listing_count,
  }));

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.partners.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.partners.heading'),
            href: `/${locale}/admin/partners`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.partners.error.title')}
          retryLabel={t('admin.partners.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <Inline gap="3" wrap>
            <Input
              aria-label={t('admin.partners.filters.keywordLabel')}
              placeholder={t('admin.partners.filters.keywordPlaceholder')}
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
              ariaLabel={t('admin.partners.filters.verificationLabel')}
              options={verificationOptions}
              value={filters.verificationStatus}
              onChange={(value) => updateFilters({ verificationStatus: value })}
            />
            <Select
              ariaLabel={t('admin.partners.filters.moderationLabel')}
              options={moderationOptions}
              value={filters.moderationStatus}
              onChange={(value) => updateFilters({ moderationStatus: value })}
            />
          </Inline>

          <DataTable
            columns={columns}
            rows={rows}
            isLoading={isPending}
            emptyTitle={t('admin.partners.empty.title')}
            emptyDescription={t('admin.partners.empty.description')}
            hasMore={Boolean(hasNextPage)}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            loadMoreLabel={t('admin.partners.loadMore')}
          />
        </Stack>
      )}
    </Section>
  );
}
