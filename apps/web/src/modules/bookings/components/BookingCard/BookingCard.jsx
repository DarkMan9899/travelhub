/**
 * BookingCard — one row of the "My bookings" list. The booking *summary*
 * shape (`bookingDto.js`'s `toBookingSummaryResponse`) carries no listing
 * title/thumbnail — only `listing_id` — so this card follows up with the
 * listing module's own `useListingQuery(listing_id)` (already built,
 * Phase 5/6) rather than the backend growing a denormalized summary DTO
 * a customer typically has only a handful of rows for; N+1 here is a
 * deliberate, small-N tradeoff, not an oversight.
 *
 * `hrefBase` (Phase 9, Partner Dashboard): defaults to the customer "My
 * Trips" detail route; a partner-side consumer passes `"partner/bookings"`
 * to reuse this exact card for their own booking-management list instead
 * of duplicating it — the row content (listing, status, price) is
 * identical for both audiences, only the destination route differs.
 * `audience` forwards to `BookingStatusBadge` for the same reason — see
 * that component's own header for which status label actually differs.
 *
 * Built on the shared `Card` primitive (Phase 10 redesign) — this row
 * hand-rolled its own hover-lift/elevation/border treatment before Card
 * existed, restating exactly the duplication Card's own header calls
 * out. Now the third real consumer of `Card`'s `interactive` variant
 * (after `ListingCard`/`SearchResultCard`), matching their -4px lift /
 * 1px border hover language for platform-wide consistency instead of
 * this row's slightly different -2px/2px values.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Card } from '@travelhub/ui/components/primitives';
import { PriceTag } from '@travelhub/ui/components/data-display';
import { Spinner } from '@travelhub/ui/components/feedback-overlays';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useListingQuery } from '../../../listings/queries/useListingQuery.js';
import getLocalizedTranslation from '../../../listings/utils/getLocalizedTranslation.js';
import BookingStatusBadge from '../BookingStatusBadge/BookingStatusBadge.jsx';
import styles from './BookingCard.module.scss';

function renderMedia({ isPending, coverMedia, styles: classNames }) {
  if (isPending) return <Spinner size="sm" decorative />;
  if (coverMedia) {
    return (
      <img
        src={coverMedia.thumbnail_url ?? coverMedia.url}
        alt=""
        className={classNames.image}
        loading="lazy"
      />
    );
  }
  return <div className={classNames.imagePlaceholder} aria-hidden="true" />;
}

export default function BookingCard({
  booking,
  hrefBase = 'account/bookings',
  audience = 'customer',
}) {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const { data: listing, isPending } = useListingQuery(booking.listing_id);
  const translation = listing
    ? getLocalizedTranslation(listing.translations, locale)
    : null;
  const coverMedia =
    listing?.media?.find((media) => media.is_cover) ?? listing?.media?.[0];
  const title = translation?.title ?? listing?.slug ?? '';
  const requestedDate = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
  }).format(new Date(booking.requested_at));

  return (
    <Card
      as={RouterLink}
      href={`/${locale}/${hrefBase}/${booking.id}`}
      interactive
      padding="none"
      className={styles.card}
      aria-label={t('bookings.list.viewDetails', {
        reference: booking.booking_reference,
      })}
    >
      <div className={styles.media}>
        {renderMedia({ isPending, coverMedia, styles })}
      </div>
      <div className={styles.body}>
        <div className={styles.header}>
          <h3 className={styles.title}>{title}</h3>
          <BookingStatusBadge status={booking.status} audience={audience} />
        </div>
        <p className={styles.reference}>{booking.booking_reference}</p>
        <p className={styles.requested}>
          {t('bookings.list.requestedOn', { date: requestedDate })}
        </p>
        <PriceTag
          amount={booking.total_amount}
          currencyCode={booking.currency}
          suffix={t('bookings.list.total')}
          size="sm"
        />
      </div>
    </Card>
  );
}

BookingCard.propTypes = {
  booking: PropTypes.shape({
    id: PropTypes.number.isRequired,
    booking_reference: PropTypes.string.isRequired,
    listing_id: PropTypes.number.isRequired,
    status: PropTypes.string.isRequired,
    currency: PropTypes.string.isRequired,
    total_amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number])
      .isRequired,
    requested_at: PropTypes.string.isRequired,
  }).isRequired,
  hrefBase: PropTypes.string,
  audience: PropTypes.oneOf(['customer', 'partner']),
};
