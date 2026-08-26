/**
 * PaymentStatusBadge — the single sanctioned mapping of a
 * `payment_intent_statuses.code` to a `Badge` variant. Mirrors
 * `modules/bookings/components/BookingStatusBadge`'s exact shape.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Badge } from '@desavii/ui/components/primitives';

const STATUS_VARIANTS = Object.freeze({
  CREATED: 'neutral',
  REQUIRES_ACTION: 'warning',
  PROCESSING: 'warning',
  AUTHORIZED: 'info',
  SUCCEEDED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  PARTIALLY_REFUNDED: 'warning',
  REFUNDED: 'neutral',
});

export default function PaymentStatusBadge({ status }) {
  const { t } = useTranslation();
  const variant = STATUS_VARIANTS[status] ?? 'neutral';
  const label = t(`payments.status.${status}`, { defaultValue: status });

  return <Badge variant={variant} label={label} />;
}

PaymentStatusBadge.propTypes = {
  status: PropTypes.string.isRequired,
};
