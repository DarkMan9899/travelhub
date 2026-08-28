import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import ConfirmProvider from '../../../../providers/ConfirmProvider.jsx';
import AdminBookingsPageContent from './AdminBookingsPageContent.jsx';
import { useAdminBookingsQuery } from '../../queries/useAdminBookingsQuery.js';

vi.mock('../../queries/useAdminBookingsQuery.js', () => ({
  useAdminBookingsQuery: vi.fn(),
}));

function bookingFixture(overrides) {
  return {
    id: 42,
    booking_reference: 'BK-20260101-ABCDEF23',
    customer_user_id: 9,
    partner_id: 3,
    listing_id: 5,
    booking_type: 'HOTEL',
    status: 'PENDING_VENDOR',
    currency: 'AMD',
    total_amount: '85000.00',
    requested_at: '2026-07-01T10:00:00.000Z',
    date_from: '2026-08-01',
    date_to: '2026-08-03',
    ...overrides,
  };
}

function renderPage({ initialEntries = ['/hy/admin/bookings'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ToastProvider>
        <ConfirmProvider>
          <Routes>
            <Route
              path="/:locale/admin/bookings"
              element={<AdminBookingsPageContent />}
            />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
}

const noopQueryExtras = {
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

describe('AdminBookingsPageContent (apps/web/src/modules/admin)', () => {
  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminBookingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      ...noopQueryExtras,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('renders a booking row with reference/customer/partner links and status/total', () => {
    useAdminBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [bookingFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    const referenceLink = screen.getByRole('link', {
      name: 'BK-20260101-ABCDEF23',
    });
    expect(referenceLink).toHaveAttribute('href', '/hy/admin/bookings/42');

    const customerLink = screen.getByRole('link', { name: 'Հաճախորդ #9' });
    expect(customerLink).toHaveAttribute('href', '/hy/admin/users/9');

    const partnerLink = screen.getByRole('link', { name: 'Գործընկեր #3' });
    expect(partnerLink).toHaveAttribute('href', '/hy/admin/partners/3');

    expect(screen.getByText(/85.000 AMD/)).toBeInTheDocument();
  });

  test('calls fetchNextPage when Load more is clicked', async () => {
    const fetchNextPage = vi.fn();
    useAdminBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [bookingFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
      fetchNextPage,
      hasNextPage: true,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Բեռնել ավելին' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  // Launch-blocker remediation (P0-B/4D): the admin bookings screen had
  // no way at all to find REQUIRES_MANUAL_REVIEW bookings — this proves
  // the new filter's value is read from the URL and threaded through to
  // the real backend query, not just rendered decoratively.
  test('reads refundStatus from the URL and passes it to useAdminBookingsQuery', () => {
    useAdminBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage({
      initialEntries: [
        '/hy/admin/bookings?refundStatus=REQUIRES_MANUAL_REVIEW',
      ],
    });

    expect(useAdminBookingsQuery).toHaveBeenCalledWith({
      status: '',
      refundStatus: 'REQUIRES_MANUAL_REVIEW',
    });
  });
});
