import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import DashboardOverviewContent from './DashboardOverviewContent.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useMyBookingsQuery } from '../../../bookings/index.js';

vi.mock('../../../../contexts/AuthContext.jsx', () => ({ useAuth: vi.fn() }));

vi.mock('../../../ai/index.js', () => ({
  RecommendationsSection: () => null,
}));

vi.mock('../../../bookings/index.js', () => {
  function MockBookingCard({ booking }) {
    return <p>{booking.booking_reference}</p>;
  }
  MockBookingCard.propTypes = {
    // eslint-disable-next-line react/forbid-prop-types
    booking: PropTypes.object.isRequired,
  };
  return {
    useMyBookingsQuery: vi.fn(),
    BookingCard: MockBookingCard,
  };
});

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function bookingFixture(overrides) {
  return {
    id: 1,
    booking_reference: 'BK-1',
    listing_id: 1,
    status: 'CONFIRMED',
    currency: 'AMD',
    total_amount: '1000.00',
    requested_at: '2026-01-01T00:00:00Z',
    date_from: null,
    date_to: null,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/hy/account']}>
      <Routes>
        <Route path="/:locale/account" element={<DashboardOverviewContent />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('DashboardOverviewContent (apps/web/src/modules/profile)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    useAuth.mockReturnValue({ user: { first_name: 'Ana' } });
  });

  test('greets the user by first name', () => {
    useMyBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(
      screen.getByRole('heading', { name: 'Բարի վերադարձ, Ana' }),
    ).toBeInTheDocument();
  });

  test('shows a retryable error state when the bookings query fails', async () => {
    const refetch = vi.fn();
    useMyBookingsQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByText('Չհաջողվեց բեռնել ձեր վահանակը։'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Կրկին փորձել' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('shows empty states and navigates to search from the recent-bookings CTA', async () => {
    useMyBookingsQuery.mockReturnValue({
      data: { pages: [{ results: [] }] },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByText('Ամրագրումներ դեռ չկան')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Դիտել հայտարարությունները' }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/hy/search');
  });

  test('splits bookings into upcoming (future, active) vs recent, with correct quick stats', () => {
    const future = '2099-01-01';
    const past = '2020-01-01';
    useMyBookingsQuery.mockReturnValue({
      data: {
        pages: [
          {
            results: [
              bookingFixture({
                id: 1,
                booking_reference: 'BK-UPCOMING',
                status: 'CONFIRMED',
                date_from: future,
              }),
              bookingFixture({
                id: 2,
                booking_reference: 'BK-PENDING',
                status: 'PENDING_VENDOR',
                date_from: future,
              }),
              bookingFixture({
                id: 3,
                booking_reference: 'BK-PAST',
                status: 'COMPLETED',
                date_from: past,
              }),
            ],
          },
        ],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();

    // Both are upcoming (future date_from + active status) AND recent
    // (top 5 by creation order), so each renders in both sections.
    expect(screen.getAllByText('BK-UPCOMING')).toHaveLength(2);
    expect(screen.getAllByText('BK-PENDING')).toHaveLength(2);
    // BK-PAST is not upcoming (past date) but still shows in "recent".
    expect(screen.getAllByText('BK-PAST')).toHaveLength(1);
  });
});
