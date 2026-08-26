/**
 * PartnerListingRoomsPageContent (P2.2A) — `/:locale/partner/listings/:id/rooms`.
 *
 * The post-publish room/unit management path the audit found missing:
 * before this, the ONLY UI for registering a bookable unit was the
 * Partner Listing Wizard's `AvailabilityStep`, and that step's old
 * behavior only ever allowed exactly one. This page reuses the SAME
 * `BookableUnitsManager` the wizard step now embeds, so a partner never
 * has to re-enter the wizard just to add a second room type or fix a
 * mistake in an existing one — same component, same mutations, no
 * duplicated logic.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@desavii/ui/components/layout';
import { Spinner, ErrorState } from '@desavii/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useListingQuery } from '../../queries/useListingQuery.js';
import BookableUnitsManager from '../BookableUnitsManager/BookableUnitsManager.jsx';

export default function PartnerListingRoomsPageContent({ listingId }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const listingQuery = useListingQuery(listingId);

  if (listingQuery.isPending) {
    return <Spinner label={t('partner.listingRooms.loading')} />;
  }
  if (listingQuery.isError) {
    return (
      <ErrorState
        title={t('partner.listingRooms.errorTitle')}
        retryLabel={t('partner.listingWizard.retry')}
        onRetry={listingQuery.refetch}
      />
    );
  }

  const listing = listingQuery.data;

  return (
    <Section>
      <PageHeader
        title={t('partner.listingRooms.heading', { title: listing.title })}
        breadcrumbs={[
          { label: t('partner.nav.dashboard'), href: `/${locale}/partner` },
          {
            label: t('partner.listings.heading'),
            href: `/${locale}/partner/listings`,
          },
          {
            label: listing.title,
            href: `/${locale}/partner/listings/${listingId}/rooms`,
          },
        ]}
      />
      <BookableUnitsManager listingId={listingId} />
    </Section>
  );
}

PartnerListingRoomsPageContent.propTypes = {
  listingId: PropTypes.number.isRequired,
};
