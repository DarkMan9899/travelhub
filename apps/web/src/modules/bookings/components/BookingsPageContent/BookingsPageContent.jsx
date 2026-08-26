/**
 * BookingsPageContent — the `bookings` module's page-level content for
 * `/:locale/account/bookings`. Phase 7 (Booking Flow): real `GET
 * /bookings` results (the caller's own "My Trips"), replacing the earlier
 * `UnderConstructionPage` placeholder — same rationale/shape as
 * `search`'s `SearchPageContent.jsx`.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@desavii/ui/components/layout';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useMyBookingsQuery } from '../../queries/useMyBookingsQuery.js';
import BookingsList from '../BookingsList/BookingsList.jsx';

export default function BookingsPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const {
    data,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMyBookingsQuery();

  const bookings = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  return (
    <Section spacing="default">
      <PageHeader
        title={t('bookings.list.heading')}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          {
            label: t('bookings.list.heading'),
            href: `/${locale}/account/bookings`,
          },
        ]}
      />
      <BookingsList
        bookings={bookings}
        isPending={isPending}
        isError={isError}
        onRetry={refetch}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={fetchNextPage}
      />
    </Section>
  );
}
