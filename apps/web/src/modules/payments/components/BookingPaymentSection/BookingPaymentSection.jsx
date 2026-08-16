/**
 * BookingPaymentSection — the orchestrator embedded into a booking-detail
 * page (customer/partner/admin). Decides between `PayNowPanel` (no
 * payment yet, or the only ones on record are terminally FAILED/
 * CANCELLED — the customer may try again) and `PaymentSummaryCard` (an
 * active or succeeded payment exists). `readOnly` hides `PayNowPanel`
 * entirely for the partner/admin views, where paying is never the
 * viewer's own action.
 *
 * Renders nothing while loading (the parent page's own Skeleton already
 * covers the loading state) and nothing on a genuine fetch error (a
 * payment section is supplementary, not the page's primary content —
 * failing to load it should never block the rest of the booking detail
 * page from rendering).
 */

import PropTypes from 'prop-types';
import { usePaymentsForBookingQuery } from '../../queries/usePaymentsForBookingQuery.js';
import PayNowPanel from '../PayNowPanel/PayNowPanel.jsx';
import PaymentSummaryCard from '../PaymentSummaryCard/PaymentSummaryCard.jsx';
import { usePaymentQuery } from '../../queries/usePaymentQuery.js';

// A booking is payable again once every existing payment for it has
// reached a terminal, non-successful state — mirrors
// `isActivePaymentStatus` in `core/domain/paymentStatusTransitions.js`.
const TERMINAL_NON_SUCCESS_STATUSES = ['FAILED', 'CANCELLED'];

export default function BookingPaymentSection({
  booking = null,
  readOnly = false,
}) {
  const paymentsQuery = usePaymentsForBookingQuery(booking?.id);
  const payments = paymentsQuery.data ?? [];
  const activePayment = payments.find(
    (payment) => !TERMINAL_NON_SUCCESS_STATUSES.includes(payment.status),
  );
  // The summary list omits `attempts`/`transactions`/nested `refunds` —
  // fetch the single-payment detail shape once an active payment id is
  // known, so `PaymentSummaryCard` always has the full breakdown.
  const paymentDetailQuery = usePaymentQuery(activePayment?.id);

  if (paymentsQuery.isPending || !booking) return null;
  if (paymentsQuery.isError) return null;

  if (!activePayment) {
    if (readOnly) return null;
    return (
      <PayNowPanel booking={booking} onPaid={() => paymentsQuery.refetch()} />
    );
  }

  if (!paymentDetailQuery.data) return null;
  return <PaymentSummaryCard payment={paymentDetailQuery.data} />;
}

BookingPaymentSection.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types -- the booking DTO shape is large and API-owned
  booking: PropTypes.object,
  readOnly: PropTypes.bool,
};
