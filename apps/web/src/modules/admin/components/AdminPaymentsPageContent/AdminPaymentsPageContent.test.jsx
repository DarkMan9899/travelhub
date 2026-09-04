import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminPaymentsPageContent from './AdminPaymentsPageContent.jsx';
import { useAdminPaymentsQuery } from '../../queries/useAdminPaymentsQuery.js';
import { usePaymentsConfigQuery } from '../../../payments/index.js';

vi.mock('../../queries/useAdminPaymentsQuery.js', () => ({
  useAdminPaymentsQuery: vi.fn(),
}));

vi.mock('../../../payments/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, usePaymentsConfigQuery: vi.fn() };
});

function paymentFixture(overrides) {
  return {
    id: 3,
    payment_reference: 'PAY-20260101-ABCDEF23',
    booking_id: 42,
    status: 'SUCCEEDED',
    provider: 'local',
    currency: 'AMD',
    total_amount: '85000.00',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/admin/payments']}>
      <Routes>
        <Route
          path="/:locale/admin/payments"
          element={<AdminPaymentsPageContent />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

const noopQueryExtras = {
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
};

describe('AdminPaymentsPageContent (apps/web/src/modules/admin)', () => {
  beforeEach(() => {
    usePaymentsConfigQuery.mockReturnValue({ data: { enabled: true } });
  });

  test('shows a retryable error state', async () => {
    const refetch = vi.fn();
    useAdminPaymentsQuery.mockReturnValue({
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

  test('renders a payment row with reference/booking links, status, and total', () => {
    useAdminPaymentsQuery.mockReturnValue({
      data: { pages: [{ results: [paymentFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    renderPage();

    const referenceLink = screen.getByRole('link', {
      name: 'PAY-20260101-ABCDEF23',
    });
    expect(referenceLink).toHaveAttribute('href', '/hy/admin/payments/3');

    const bookingLink = screen.getByRole('link', { name: 'Ամրագրում #42' });
    expect(bookingLink).toHaveAttribute('href', '/hy/admin/bookings/42');

    expect(screen.getByText('Վճարված')).toBeInTheDocument();
    expect(screen.getByText(/85.000 AMD/)).toBeInTheDocument();
  });

  test('calls fetchNextPage when Load more is clicked', async () => {
    const fetchNextPage = vi.fn();
    useAdminPaymentsQuery.mockReturnValue({
      data: { pages: [{ results: [paymentFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
      fetchNextPage,
      hasNextPage: true,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Ցույց տալ ավելին' }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  test('shows a calm paused-payments banner when PAYMENTS_ENABLED is false, and nothing when enabled', () => {
    useAdminPaymentsQuery.mockReturnValue({
      data: { pages: [{ results: [paymentFixture()] }] },
      isPending: false,
      isError: false,
      ...noopQueryExtras,
    });
    usePaymentsConfigQuery.mockReturnValue({ data: { enabled: false } });
    const { unmount } = renderPage();

    expect(screen.getByText('Վճարումները դադարեցված են')).toBeInTheDocument();
    unmount();

    usePaymentsConfigQuery.mockReturnValue({ data: { enabled: true } });
    renderPage();
    expect(
      screen.queryByText('Վճարումները դադարեցված են'),
    ).not.toBeInTheDocument();
  });
});
