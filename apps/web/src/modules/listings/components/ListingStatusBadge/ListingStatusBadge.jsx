/**
 * ListingStatusBadge — Phase 9 (Partner Dashboard): the single sanctioned
 * mapping of a `listings.status_id`-resolved status code to a `Badge`
 * variant, mirroring `modules/bookings/components/BookingStatusBadge`
 * exactly. A status code this component doesn't recognize falls back to
 * a neutral badge with the raw code, same "never hardcode a business
 * rule as a crash" rationale as its bookings counterpart.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Badge } from '@desavii/ui/components/primitives';

const STATUS_VARIANTS = Object.freeze({
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  UNPUBLISHED: 'warning',
  ARCHIVED: 'neutral',
});

export default function ListingStatusBadge({ status }) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANTS[status] ?? 'neutral';
  const label = t(`listings.status.${status}`, { defaultValue: status });

  return <Badge variant={variant} label={label} />;
}

ListingStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};
