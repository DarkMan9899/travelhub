/**
 * AdminBookingsPageContent — `/:locale/admin/bookings` (Stage 11.4:
 * Booking Operations). Orchestrator, same shape as
 * `AdminListingModerationPageContent`: a URL-synced `status` filter
 * (`useAdminListFilters`) over the `useAdminBookingsQuery` infinite
 * query (`GET /bookings?viewAll=true`), rendered via the shared
 * `DataTable` primitive.
 *
 * Reference/customer/partner columns are all links (to this booking's
 * own new detail page, and to the existing Stage 11.1/11.2 detail pages)
 * — the admin summary DTO carries `customer_user_id`/`partner_id`
 * precisely so this list can cross-link without a second request per row.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import { Select } from '@travelhub/ui/components/form-controls';
import { DataTable } from '@travelhub/ui/components/dashboard';
import { ErrorState } from '@travelhub/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAdminListFilters } from '../../hooks/useAdminListFilters.js';
import { useAdminBookingsQuery } from '../../queries/useAdminBookingsQuery.js';
import { BookingStatusBadge } from '../../../bookings/index.js';

const DEFAULT_FILTERS = { status: '' };

const STATUS_CODES = [
  'DRAFT',
  'PENDING_VENDOR',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED_BY_CUSTOMER',
  'CANCELLED_BY_VENDOR',
  'COMPLETED',
  'NO_SHOW',
  'EXPIRED',
];

export default function AdminBookingsPageContent() {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();

  const { filters, updateFilters } = useAdminListFilters(DEFAULT_FILTERS);

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminBookingsQuery({ status: filters.status });

  const bookings = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  const statusOptions = [
    { value: '', label: t('admin.bookings.filters.statusAll') },
    ...STATUS_CODES.map((code) => ({
      value: code,
      label: t(`bookings.status.${code}`, { defaultValue: code }),
    })),
  ];

  const amountFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language),
    [i18n.language],
  );

  const columns = [
    {
      key: 'reference',
      header: t('admin.bookings.table.reference'),
      render: (booking) => (
        <RouterLink href={`/${locale}/admin/bookings/${booking.id}`}>
          {booking.booking_reference}
        </RouterLink>
      ),
    },
    {
      key: 'customer',
      header: t('admin.bookings.table.customer'),
      render: (booking) => (
        <RouterLink href={`/${locale}/admin/users/${booking.customer_user_id}`}>
          {t('admin.bookings.table.customerLink', {
            id: booking.customer_user_id,
          })}
        </RouterLink>
      ),
    },
    {
      key: 'partner',
      header: t('admin.bookings.table.partner'),
      render: (booking) => (
        <RouterLink href={`/${locale}/admin/partners/${booking.partner_id}`}>
          {t('admin.bookings.table.partnerLink', {
            id: booking.partner_id,
          })}
        </RouterLink>
      ),
    },
    {
      key: 'status',
      header: t('admin.bookings.table.status'),
      render: (booking) => <BookingStatusBadge status={booking.status} />,
    },
    {
      key: 'total',
      header: t('admin.bookings.table.total'),
      render: (booking) =>
        `${amountFormatter.format(booking.total_amount)} ${booking.currency}`,
    },
  ];

  return (
    <Section spacing="default">
      <PageHeader
        title={t('admin.bookings.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.bookings.heading'),
            href: `/${locale}/admin/bookings`,
          },
        ]}
      />

      {isError ? (
        <ErrorState
          title={t('admin.bookings.error.title')}
          retryLabel={t('admin.bookings.error.retry')}
          onRetry={refetch}
        />
      ) : (
        <Stack gap="4">
          <Inline gap="3" wrap>
            <Select
              ariaLabel={t('admin.bookings.filters.statusLabel')}
              options={statusOptions}
              value={filters.status}
              onChange={(value) => updateFilters({ status: value })}
            />
          </Inline>

          <DataTable
            columns={columns}
            rows={bookings}
            isLoading={isPending}
            emptyTitle={t('admin.bookings.empty.title')}
            emptyDescription={t('admin.bookings.empty.description')}
            hasMore={Boolean(hasNextPage)}
            isLoadingMore={isFetchingNextPage}
            onLoadMore={fetchNextPage}
            loadMoreLabel={t('admin.bookings.loadMore')}
          />
        </Stack>
      )}
    </Section>
  );
}
