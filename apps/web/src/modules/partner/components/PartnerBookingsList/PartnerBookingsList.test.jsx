import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartnerBookingsList from './PartnerBookingsList.jsx';
import { getListing } from '../../../../api/listings.js';

vi.mock('../../../../api/listings.js', () => ({
  getListing: vi.fn(),
}));

const BOOKINGS = [
  {
    id: 1,
    booking_reference: 'BK-20260101-ABCDEF23',
    listing_id: 1,
    status: 'PENDING_VENDOR',
    currency: 'AMD',
    total_amount: '85000.00',
    requested_at: '2026-07-01T10:00:00.000Z',
  },
  {
    id: 2,
    booking_reference: 'BK-20260102-BBCDEF23',
    listing_id: 2,
    status: 'CANCELLED_BY_CUSTOMER',
    currency: 'AMD',
    total_amount: '25000.00',
    requested_at: '2026-07-02T10:00:00.000Z',
  },
];

function renderList(props) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route
            path="/:locale"
            element={
              <PartnerBookingsList
                bookings={[]}
                isPending={false}
                isError={false}
                onRetry={vi.fn()}
                hasNextPage={false}
                isFetchingNextPage={false}
                onLoadMore={vi.fn()}
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...props}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PartnerBookingsList (apps/web/src/modules/partner)', () => {
  beforeEach(() => {
    getListing.mockReset();
    getListing.mockResolvedValue({
      data: { id: 1, slug: 'sunset-ridge-villa', translations: [], media: [] },
    });
  });

  test('renders skeleton placeholders while pending', () => {
    renderList({ isPending: true });
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('renders an error state with a working retry action', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderList({ isError: true, onRetry });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders an empty state when there are no bookings', () => {
    renderList({ bookings: [] });
    expect(
      screen.getByRole('heading', {
        name: 'Ձեր ֆիլտրերին համապատասխան ամրագրումներ չկան',
      }),
    ).toBeInTheDocument();
  });

  test('renders one card per booking, each linking to the partner detail route, with the partner-directional status label', async () => {
    renderList({ bookings: BOOKINGS });
    await waitFor(() => expect(screen.getAllByRole('link')).toHaveLength(2));
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/hy/partner/bookings/1');
    expect(links[1]).toHaveAttribute('href', '/hy/partner/bookings/2');
    expect(
      screen.getByText('Չեղարկվել է հաճախորդի կողմից'),
    ).toBeInTheDocument();
  });

  test('renders a load more control only when hasNextPage is true, and calls onLoadMore', async () => {
    const onLoadMore = vi.fn();
    const user = userEvent.setup();
    renderList({ bookings: BOOKINGS, hasNextPage: true, onLoadMore });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Բեռնել ավելին' }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole('button', { name: 'Բեռնել ավելին' }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
