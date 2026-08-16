/**
 * AdminUsersPageContent — `/:locale/admin/users` (User Management).
 * Orchestrator: owns URL-synced keyword/status filter state
 * (`useAdminListFilters` — an admin's filtered view should be a
 * shareable link, per that hook's own header comment) and the
 * `useAdminUsersQuery` infinite query, rendered via the shared
 * `DataTable` primitive rather than a bespoke list component.
 *
 * The suspend/activate/ban action lives directly in each row (not only
 * on the detail page) — same "act from the list, don't force a detour"
 * convenience `PartnerListingsList`'s row actions already establish.
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import { Input, Select } from '@travelhub/ui/components/form-controls';
import { Button, Badge } from '@travelhub/ui/components/primitives';
import { DataTable } from '@travelhub/ui/components/dashboard';
import { ErrorState } from '@travelhub/ui/components/feedback-overlays';
import { Search } from 'lucide-react';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useAdminListFilters } from '../../hooks/useAdminListFilters.js';
import { useAdminUsersQuery } from '../../queries/useAdminUsersQuery.js';
import { useUpdateUserStatusMutation } from '../../mutations/useUpdateUserStatusMutation.js';

const STATUS_BADGE_VARIANT = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  BANNED: 'danger',
  PENDING_DELETION: 'neutral',
};

const DEFAULT_FILTERS = { keyword: '', status: '' };

export default function AdminUsersPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { permissions } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const canSuspend = permissions.includes('user.suspend');

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
  } = useAdminUsersQuery({ keyword: filters.keyword, status: filters.status });
  const updateStatusMutation = useUpdateUserStatusMutation();

  const users = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const statusOptions = [
    { value: '', label: t('admin.users.filters.statusAll') },
    { value: 'ACTIVE', label: t('admin.users.status.ACTIVE') },
    { value: 'SUSPENDED', label: t('admin.users.status.SUSPENDED') },
    { value: 'BANNED', label: t('admin.users.status.BANNED') },
  ];

  async function handleToggleStatus(user) {
    const nextStatus =
      user.status_code === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const confirmed = await confirm({
      title: t(
        nextStatus === 'SUSPENDED'
          ? 'admin.users.suspendConfirmTitle'
          : 'admin.users.activateConfirmTitle',
        { name: `${user.first_name} ${user.last_name}` },
      ),
      description: t(
        nextStatus === 'SUSPENDED'
          ? 'admin.users.suspendConfirmDescription'
          : 'admin.users.activateConfirmDescription',
      ),
      confirmLabel: t(
        nextStatus === 'SUSPENDED'
          ? 'admin.users.suspendConfirmAction'
          : 'admin.users.activateConfirmAction',
      ),
      cancelLabel: t('common.cancel'),
      variant: nextStatus === 'SUSPENDED' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: user.id,
        status: nextStatus,
      });
      showToast(
        t(
          nextStatus === 'SUSPENDED'
            ? 'admin.users.suspendSuccess'
            : 'admin.users.activateSuccess',
        ),
        { variant: 'success' },
      );
    } catch {
      showToast(t('admin.users.statusError'), { variant: 'danger' });
    }
  }

  const columns = [
    {
      key: 'name',
      header: t('admin.users.table.name'),
      render: (user) => (
        <RouterLink href={`/${locale}/admin/users/${user.id}`}>
          {user.first_name} {user.last_name}
        </RouterLink>
      ),
    },
    { key: 'email', header: t('admin.users.table.email') },
    {
      key: 'status',
      header: t('admin.users.table.status'),
      render: (user) => (
        <Badge
          variant={STATUS_BADGE_VARIANT[user.status_code] ?? 'neutral'}
          size="sm"
          label={t(`admin.users.status.${user.status_code}`, {
            defaultValue: user.status_code,
          })}
        />
      ),
    },
    {
      key: 'roles',
      header: t('admin.users.table.roles'),
      render: (user) => user.role_codes.join(', ') || '—',
    },
    {
      key: 'actions',
      header: '',
      render: (user) =>
        canSuspend ? (
          <Button
            variant={
              user.status_code === 'SUSPENDED' ? 'primary' : 'destructive'
            }
            size="sm"
            onClick={() => handleToggleStatus(user)}
            loading={
              updateStatusMutation.isPending &&
              updateStatusMutation.variables?.id === user.id
            }
          >
            {t(
              user.status_code === 'SUSPENDED'
                ? 'admin.users.activateConfirmAction'
                : 'admin.users.suspendConfirmAction',
            )}
          </Button>
        ) : null,
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.users.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          { label: t('admin.users.heading'), href: `/${locale}/admin/users` },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.users.error.title')}
          retryLabel={t('admin.users.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <Inline gap="3" wrap>
            <Input
              aria-label={t('admin.users.filters.keywordLabel')}
              placeholder={t('admin.users.filters.keywordPlaceholder')}
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
              ariaLabel={t('admin.users.filters.statusLabel')}
              options={statusOptions}
              value={filters.status}
              onChange={(value) => updateFilters({ status: value })}
            />
          </Inline>

          <DataTable
            columns={columns}
            rows={users}
            isLoading={isPending}
            emptyTitle={t('admin.users.empty.title')}
            emptyDescription={t('admin.users.empty.description')}
            hasMore={Boolean(hasNextPage)}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            loadMoreLabel={t('admin.users.loadMore')}
          />
        </Stack>
      )}
    </Section>
  );
}
