/**
 * BookingStatusBadge — the single sanctioned mapping of a
 * `booking_statuses.code` to a `Badge` variant (per `Badge.jsx`'s own
 * header comment: "reused, never re-implemented, by BookingStatusBadge...
 * usages built in later, feature-owning sprints"). A status code this
 * component doesn't recognize (there is no such code today, but the
 * lookup-table vocabulary could grow) falls back to a neutral badge with
 * the raw code rather than throwing, per the Generic Attribute Engine's
 * "never hardcode a business rule as a crash" ethos.
 *
 * `audience` (Phase 9, Partner Dashboard): `bookings.status.*`'s default
 * copy is written from the customer's point of view ("Cancelled by
 * you" for `CANCELLED_BY_CUSTOMER`) — factually backwards when this same
 * badge renders in a partner's booking list/detail. `audience="partner"`
 * swaps in a `bookings.status.partner.*` override for the one status
 * where that distinction actually matters; `CANCELLED_BY_VENDOR`
 * ("Cancelled by host") already reads correctly for a partner, so it has
 * no override.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Badge } from '@travelhub/ui/components/primitives';

const STATUS_VARIANTS = Object.freeze({
  DRAFT: 'neutral',
  PENDING_VENDOR: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'danger',
  CANCELLED_BY_CUSTOMER: 'danger',
  CANCELLED_BY_VENDOR: 'danger',
  COMPLETED: 'success',
  NO_SHOW: 'neutral',
  EXPIRED: 'neutral',
});

const PARTNER_AUDIENCE_OVERRIDES = new Set(['CANCELLED_BY_CUSTOMER']);

export default function BookingStatusBadge({ status, audience = 'customer' }) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANTS[status] ?? 'neutral';
  const label =
    audience === 'partner' && PARTNER_AUDIENCE_OVERRIDES.has(status)
      ? t(`bookings.status.partner.${status}`, { defaultValue: status })
      : t(`bookings.status.${status}`, { defaultValue: status });

  return <Badge variant={variant} label={label} />;
}

BookingStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
  audience: PropTypes.oneOf(['customer', 'partner']),
};
