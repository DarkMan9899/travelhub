import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminBookingDetailContent from './AdminBookingDetailContent.jsx';
import { useAdminBookingDetailQuery } from '../../queries/useAdminBookingDetailQuery.js';
import { useAdminBookingHistoryQuery } from '../../queries/useAdminBookingHistoryQuery.js';
import { useAdminConfirmBookingMutation } from '../../mutations/useAdminConfirmBookingMutation.js';
import { useAdminRejectBookingMutation } from '../../mutations/useAdminRejectBookingMutation.js';
import { useAdminCancelBookingMutation } from '../../mutations/useAdminCancelBookingMutation.js';
import { useAdminCompleteBookingMutation } from '../../mutations/useAdminCompleteBookingMutation.js';
import { useAdminMarkNoShowMutation } from '../../mutations/useAdminMarkNoShowMutation.js';
import { useAuth } from '../../../../contexts/AuthContext.jsx';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../../queries/useAdminBookingDetailQuery.js', () => ({
  useAdminBookingDetailQuery: vi.fn(),
}));
vi.mock('../../queries/useAdminBookingHistoryQuery.js', () => ({
  useAdminBookingHistoryQuery: vi.fn(),
}));
vi.mock('../../mutations/useAdminConfirmBookingMutation.js', () => ({
  useAdminConfirmBookingMutation: vi.fn(),
}));
vi.mock('../../mutations/useAdminRejectBookingMutation.js', () => ({
  useAdminRejectBookingMutation: vi.fn(),
}));
vi.mock('../../mutations/useAdminCancelBookingMutation.js', () => ({
  useAdminCancelBookingMutation: vi.fn(),
}));
vi.mock('../../mutations/useAdminCompleteBookingMutation.js', () => ({
  useAdminCompleteBookingMutation: vi.fn(),
}));
vi.mock('../../mutations/useAdminMarkNoShowMutation.js', () => ({
  useAdminMarkNoShowMutation: vi.fn(),
}));

const BASE_BOOKING = {
  id: 7,
  booking_reference: 'BK-20260101-ABCDEF23',
  customer_user_id: 9,
  partner_id: 3,
  listing_id: 5,
  status: 'PENDING_VENDOR',
  currency: 'AMD',
  total_amount: '85000.00',
  customer_notes: null,
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

const BASE_HISTORY = [
  {
    id: 1,
    from_status: null,
    to_status: 'PENDING_VENDOR',
    changed_by: null,
    changed_at: '2026-07-01T10:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/bookings/7']}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/bookings/:id"
              element={<AdminBookingDetailContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('AdminBookingDetailContent (apps/web/src/modules/admin)', () => {
  let confirmMutateAsync;
  let rejectMutateAsync;
  let cancelMutateAsync;
  let completeMutateAsync;
  let noShowMutateAsync;

  beforeEach(() => {
    confirmMutateAsync = vi.fn().mockResolvedValue({});
    rejectMutateAsync = vi.fn().mockResolvedValue({});
    cancelMutateAsync = vi.fn().mockResolvedValue({});
    completeMutateAsync = vi.fn().mockResolvedValue({});
    noShowMutateAsync = vi.fn().mockResolvedValue({});
    useAdminConfirmBookingMutation.mockReturnValue({
      mutateAsync: confirmMutateAsync,
      isPending: false,
    });
    useAdminRejectBookingMutation.mockReturnValue({
      mutateAsync: rejectMutateAsync,
      isPending: false,
    });
    useAdminCancelBookingMutation.mockReturnValue({
      mutateAsync: cancelMutateAsync,
      isPending: false,
    });
    useAdminCompleteBookingMutation.mockReturnValue({
      mutateAsync: completeMutateAsync,
      isPending: false,
    });
    useAdminMarkNoShowMutation.mockReturnValue({
      mutateAsync: noShowMutateAsync,
      isPending: false,
    });
    useAdminBookingHistoryQuery.mockReturnValue({
      data: BASE_HISTORY,
      isPending: false,
    });
    useAuth.mockReturnValue({
      permissions: ['booking.confirm', 'booking.reject', 'booking.cancel_any'],
    });
  });

  test('shows Confirm/Reject for PENDING_VENDOR, hides Cancel/Complete/No-show', () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Հաստատել' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Մերժել' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Չեղարկել' }),
    ).not.toBeInTheDocument();
  });

  test('shows Cancel/Complete/No-show for CONFIRMED, hides Confirm/Reject', () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: { ...BASE_BOOKING, status: 'CONFIRMED' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('button', { name: 'Չեղարկել' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Նշել ավարտված' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Նշել չներկայացած' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Հաստատել' }),
    ).not.toBeInTheDocument();
  });

  test('hides every action for a terminal status', () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: { ...BASE_BOOKING, status: 'COMPLETED' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.queryByRole('button', { name: 'Հաստատել' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Չեղարկել' }),
    ).not.toBeInTheDocument();
  });

  test('renders customer/partner links', () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('link', { name: 'Հաճախորդ #9' })).toHaveAttribute(
      'href',
      '/hy/admin/users/9',
    );
    expect(screen.getByRole('link', { name: 'Գործընկեր #3' })).toHaveAttribute(
      'href',
      '/hy/admin/partners/3',
    );
  });

  test('renders the real status history timeline', () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText(/Ստեղծված/)).toBeInTheDocument();
  });

  test('confirming calls the mutation and shows a success toast', async () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: BASE_BOOKING,
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Հաստատել' }));
    await waitFor(() =>
      expect(confirmMutateAsync).toHaveBeenCalledWith({ id: 7 }),
    );
    expect(
      await screen.findByText('Ամրագրումը հաստատվել է։'),
    ).toBeInTheDocument();
  });

  test('cancelling requires confirmation, then calls the mutation', async () => {
    useAdminBookingDetailQuery.mockReturnValue({
      data: { ...BASE_BOOKING, status: 'CONFIRMED' },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Չեղարկել' }));
    expect(cancelMutateAsync).not.toHaveBeenCalled();

    const confirmButtons = screen.getAllByRole('button', {
      name: 'Չեղարկել',
    });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    await waitFor(() =>
      expect(cancelMutateAsync).toHaveBeenCalledWith({ id: 7 }),
    );
  });

  test('renders a 404 empty state for a genuine not-found error', () => {
    useAdminBookingDetailQuery.mockReturnValue({
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
    useAdminBookingDetailQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      error: { status: 500 },
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
