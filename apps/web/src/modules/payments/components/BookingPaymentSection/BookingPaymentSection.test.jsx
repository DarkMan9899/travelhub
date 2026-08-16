import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import BookingPaymentSection from './BookingPaymentSection.jsx';
import { usePaymentsForBookingQuery } from '../../queries/usePaymentsForBookingQuery.js';
import { usePaymentQuery } from '../../queries/usePaymentQuery.js';

vi.mock('../../queries/usePaymentsForBookingQuery.js', () => ({
  usePaymentsForBookingQuery: vi.fn(),
}));
vi.mock('../../queries/usePaymentQuery.js', () => ({
  usePaymentQuery: vi.fn(),
}));
vi.mock('../PayNowPanel/PayNowPanel.jsx', () => ({
  default: () => <div>PayNowPanel</div>,
}));
vi.mock('../PaymentSummaryCard/PaymentSummaryCard.jsx', () => ({
  default: () => <div>PaymentSummaryCard</div>,
}));

const BOOKING = { id: 7 };

describe('BookingPaymentSection (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    usePaymentsForBookingQuery.mockReset();
    usePaymentQuery.mockReset();
    usePaymentQuery.mockReturnValue({ data: undefined });
  });

  test('renders nothing while the booking is not yet resolved', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = render(<BookingPaymentSection booking={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders nothing on a fetch error (supplementary, must not block the page)', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch: vi.fn(),
    });
    const { container } = render(<BookingPaymentSection booking={BOOKING} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders PayNowPanel when no payment exists yet and readOnly is false', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<BookingPaymentSection booking={BOOKING} />);
    expect(screen.getByText('PayNowPanel')).toBeInTheDocument();
  });

  test('renders nothing (not PayNowPanel) when no payment exists yet and readOnly is true', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = render(
      <BookingPaymentSection booking={BOOKING} readOnly />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('treats every existing payment as retryable when all are FAILED/CANCELLED', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: [
        { id: 1, status: 'FAILED' },
        { id: 2, status: 'CANCELLED' },
      ],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    render(<BookingPaymentSection booking={BOOKING} />);
    expect(screen.getByText('PayNowPanel')).toBeInTheDocument();
  });

  test('renders PaymentSummaryCard once an active payment exists and its detail has loaded', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: [{ id: 3, status: 'SUCCEEDED' }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePaymentQuery.mockReturnValue({ data: { id: 3, status: 'SUCCEEDED' } });
    render(<BookingPaymentSection booking={BOOKING} />);
    expect(screen.getByText('PaymentSummaryCard')).toBeInTheDocument();
  });

  test('renders nothing while the active payment detail is still loading', () => {
    usePaymentsForBookingQuery.mockReturnValue({
      data: [{ id: 3, status: 'PROCESSING' }],
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    usePaymentQuery.mockReturnValue({ data: undefined });
    const { container } = render(<BookingPaymentSection booking={BOOKING} />);
    expect(container).toBeEmptyDOMElement();
  });
});
