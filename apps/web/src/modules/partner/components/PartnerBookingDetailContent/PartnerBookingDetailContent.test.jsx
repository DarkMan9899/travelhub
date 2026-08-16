import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import PartnerBookingDetailContent from './PartnerBookingDetailContent.jsx';
import {
  useBookingQuery,
  useConfirmBookingMutation,
  useRejectBookingMutation,
  useCancelBookingMutation,
} from '../../../bookings/index.js';
import { useCreateConversationMutation } from '../../../messaging/index.js';

vi.mock('../../../bookings/index.js', async () => {
  const actual = await vi.importActual('../../../bookings/index.js');
  return {
    ...actual,
    useBookingQuery: vi.fn(),
    useConfirmBookingMutation: vi.fn(),
    useRejectBookingMutation: vi.fn(),
    useCancelBookingMutation: vi.fn(),
  };
});
vi.mock('../../../messaging/index.js', () => ({
  useCreateConversationMutation: vi.fn(),
}));
vi.mock('../../../payments/index.js', () => ({
  BookingPaymentSection: () => null,
}));

const BASE_BOOKING = {
  id: 7,
  booking_reference: 'BK-20260101-ABCDEF23',
  status: 'PENDING_VENDOR',
  currency: 'AMD',
  total_amount: '85000.00',
  customer_notes: null,
  customer_user_id: 55,
  requested_at: '2026-07-01T10:00:00.000Z',
  confirmed_at: null,
  rejected_at: null,
  cancelled_at: null,
  completed_at: null,
  guest_contact_snapshot: {
    fullName: 'Ana Smith',
    email: 'ana@example.com',
    phone: '+37411000000',
  },
  items: [
    {
      id: 1,
      date_from: '2026-08-01',
      date_to: '2026-08-03',
      quantity: 1,
      unit_price_amount: '85000.00',
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/partner/bookings/7']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/partner/bookings/:id"
              element={<PartnerBookingDetailContent />}
            />
            <Route
              path="/:locale/partner/messages/:conversationId"
              element={<div>Conversation thread page</div>}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('PartnerBookingDetailContent (apps/web/src/modules/partner)', () => {
  let confirmMutateAsync;
  let rejectMutateAsync;
  let cancelMutateAsync;

  beforeEach(() => {
    confirmMutateAsync = vi.fn().mockResolvedValue({});
    rejectMutateAsync = vi.fn().mockResolvedValue({});
    cancelMutateAsync = vi.fn().mockResolvedValue({});
    useConfirmBookingMutation.mockReturnValue({
      mutateAsync: confirmMutateAsync,
      isPending: false,
    });
    useRejectBookingMutation.mockReturnValue({
      mutateAsync: rejectMutateAsync,
      isPending: false,
    });
    useCancelBookingMutation.mockReturnValue({
      mutateAsync: cancelMutateAsync,
      isPending: false,
    });
    useCreateConversationMutation.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ data: { id: 99 } }),
      isPending: false,
    });
  });

  test('shows Confirm and Reject for PENDING_VENDOR, hides Cancel', () => {
    useBookingQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Հաստատել ամրագրումը' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Մերժել ամրագրումը' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Չեղարկել ամրագրումը' }),
    ).not.toBeInTheDocument();
  });

  test('shows Cancel for CONFIRMED, hides Confirm/Reject', () => {
    useBookingQuery.mockReturnValue({
      data: {
        ...BASE_BOOKING,
        status: 'CONFIRMED',
        confirmed_at: '2026-07-02T10:00:00.000Z',
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Չեղարկել ամրագրումը' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Հաստատել ամրագրումը' }),
    ).not.toBeInTheDocument();
  });

  test('hides every action for a terminal status', () => {
    useBookingQuery.mockReturnValue({
      data: {
        ...BASE_BOOKING,
        status: 'COMPLETED',
        completed_at: '2026-08-04T10:00:00.000Z',
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.queryByRole('button', { name: 'Հաստատել ամրագրումը' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Մերժել ամրագրումը' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Չեղարկել ամրագրումը' }),
    ).not.toBeInTheDocument();
  });

  test('confirming calls the mutation and shows a success toast', async () => {
    useBookingQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Հաստատել ամրագրումը' }),
    );
    await waitFor(() => expect(confirmMutateAsync).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Ամրագրումը հաստատվել է։'),
    ).toBeInTheDocument();
  });

  test('rejecting requires confirmation, then calls the mutation and shows a success toast', async () => {
    useBookingQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Մերժել ամրագրումը' }));
    expect(rejectMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Այո, մերժել' }));
    await waitFor(() => expect(rejectMutateAsync).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Ամրագրումը մերժվել է։'),
    ).toBeInTheDocument();
  });

  test('cancelling requires confirmation, then calls the mutation and shows a success toast', async () => {
    useBookingQuery.mockReturnValue({
      data: {
        ...BASE_BOOKING,
        status: 'CONFIRMED',
        confirmed_at: '2026-07-02T10:00:00.000Z',
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Չեղարկել ամրագրումը' }),
    );
    expect(cancelMutateAsync).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Այո, չեղարկել' }));
    await waitFor(() => expect(cancelMutateAsync).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('Ամրագրումը չեղարկվել է։'),
    ).toBeInTheDocument();
  });

  test('renders the timeline from present timestamp fields only', () => {
    useBookingQuery.mockReturnValue({
      data: {
        ...BASE_BOOKING,
        status: 'CONFIRMED',
        confirmed_at: '2026-07-02T10:00:00.000Z',
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/Ուղարկվել է հայտ:/)).toBeInTheDocument();
    expect(screen.getByText(/Հաստատվել է:/)).toBeInTheDocument();
    expect(screen.queryByText(/Մերժվել է:/)).not.toBeInTheDocument();
  });

  test('renders a 404 empty state for a genuine not-found error', () => {
    useBookingQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 404 },
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Էջը չի գտնվել' }),
    ).toBeInTheDocument();
  });

  test('renders a retryable error state for a non-404 error', () => {
    useBookingQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 500 },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  // Unlike the customer-side Message action (gated on the partner's
  // resolvable owner user id), `customer_user_id` is a NOT NULL column
  // on every booking — Message customer is always shown, regardless of
  // status, mirroring Confirm/Reject/Cancel's own always-relevant intent.
  test('always shows the Message customer action, regardless of booking status', () => {
    useBookingQuery.mockReturnValue({
      data: {
        ...BASE_BOOKING,
        status: 'COMPLETED',
        completed_at: '2026-08-04T10:00:00.000Z',
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Գրել հաճախորդին' }),
    ).toBeInTheDocument();
  });

  test('clicking Message customer creates a booking-scoped conversation and navigates to its thread', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({ data: { id: 99 } });
    useCreateConversationMutation.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    useBookingQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Գրել հաճախորդին' }));
    expect(mutateAsync).toHaveBeenCalledWith({
      participantUserIds: [55],
      contextType: 'booking',
      contextId: 7,
    });
    expect(
      await screen.findByText('Conversation thread page'),
    ).toBeInTheDocument();
  });

  test('shows an error toast when starting a conversation with the customer fails', async () => {
    useCreateConversationMutation.mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error('network error')),
      isPending: false,
    });
    useBookingQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Գրել հաճախորդին' }));
    expect(
      await screen.findByText(
        'Չհաջողվեց սկսել զրույց հաճախորդի հետ։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
  });
});
