import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PaymentSummaryCard from './PaymentSummaryCard.jsx';

const BASE_PAYMENT = {
  id: 3,
  payment_reference: 'PAY-20260101-ABCDEF23',
  status: 'SUCCEEDED',
  provider: 'local',
  currency: 'AMD',
  total_amount: '85000.00',
  refunded_amount: '0.00',
  refundable_amount: '85000.00',
  succeeded_at: '2026-08-01T10:00:00.000Z',
  failure_message: null,
  is_simulated: true,
  refunds: [],
};

describe('PaymentSummaryCard (apps/web/src/modules/payments)', () => {
  test('renders the simulated-payment notice when is_simulated is true', () => {
    render(<PaymentSummaryCard payment={BASE_PAYMENT} />);
    expect(
      screen.getByText('Փորձնական/Ցուցադրական վճարում'),
    ).toBeInTheDocument();
  });

  test('omits the simulated-payment notice when is_simulated is false', () => {
    render(
      <PaymentSummaryCard payment={{ ...BASE_PAYMENT, is_simulated: false }} />,
    );
    expect(
      screen.queryByText(/Իրական գումար չի գանձվում/),
    ).not.toBeInTheDocument();
  });

  test('renders the payment reference and status', () => {
    render(<PaymentSummaryCard payment={BASE_PAYMENT} />);
    expect(screen.getByText(/PAY-20260101-ABCDEF23/)).toBeInTheDocument();
    expect(screen.getByText('Վճարված')).toBeInTheDocument();
  });

  test('shows the failure message for a FAILED payment', () => {
    render(
      <PaymentSummaryCard
        payment={{
          ...BASE_PAYMENT,
          status: 'FAILED',
          failure_message: 'The card was declined.',
        }}
      />,
    );
    expect(screen.getByText('The card was declined.')).toBeInTheDocument();
  });

  test('renders a refunds section once refunded_amount is greater than zero', () => {
    render(
      <PaymentSummaryCard
        payment={{
          ...BASE_PAYMENT,
          status: 'PARTIALLY_REFUNDED',
          refunded_amount: '20000.00',
          refundable_amount: '65000.00',
          refunds: [
            {
              id: 1,
              refund_reference: 'RF-20260102-ABCDEF23',
              amount: '20000.00',
              currency: 'AMD',
            },
          ],
        }}
      />,
    );
    expect(screen.getByText('Վերադարձներ')).toBeInTheDocument();
    expect(screen.getByText('RF-20260102-ABCDEF23')).toBeInTheDocument();
  });

  test('omits the refunds section when nothing has been refunded', () => {
    render(<PaymentSummaryCard payment={BASE_PAYMENT} />);
    expect(screen.queryByText('Վերադարձներ')).not.toBeInTheDocument();
  });
});
