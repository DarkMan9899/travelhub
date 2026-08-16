import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyBookingsQuery } from './useMyBookingsQuery.js';
import { listMyBookings } from '../../../api/bookings.js';

vi.mock('../../../api/bookings.js', () => ({
  listMyBookings: vi.fn(),
}));

function queryStatus(isPending, isError) {
  if (isPending) return 'pending';
  if (isError) return 'error';
  return 'success';
}

function Harness() {
  const { data, isPending, isError, hasNextPage, fetchNextPage } =
    useMyBookingsQuery();
  const results = data?.pages.flatMap((page) => page.results) ?? [];
  return (
    <div>
      <p data-testid="status">{queryStatus(isPending, isError)}</p>
      <p data-testid="count">{results.length}</p>
      <p data-testid="hasNextPage">{String(Boolean(hasNextPage))}</p>
      <button type="button" onClick={() => fetchNextPage()}>
        load more
      </button>
    </div>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('useMyBookingsQuery (apps/web/src/modules/bookings)', () => {
  beforeEach(() => {
    listMyBookings.mockReset();
  });

  test('resolves the first page of the caller-own bookings list', async () => {
    listMyBookings.mockResolvedValue({
      data: [{ id: 1, booking_reference: 'BK-20260101-ABCDEF23' }],
      meta: { next_cursor: null, has_more: false, limit: 10 },
    });
    renderHarness();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('hasNextPage')).toHaveTextContent('false');
    expect(listMyBookings).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 }),
    );
  });

  test('surfaces a query error rather than throwing', async () => {
    listMyBookings.mockRejectedValue(new Error('network down'));
    renderHarness();
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('error'),
    );
  });

  test('fetchNextPage appends the next cursor page', async () => {
    const user = userEvent.setup();
    listMyBookings
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        meta: { next_cursor: 'cursor-1', has_more: true, limit: 10 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 2 }],
        meta: { next_cursor: null, has_more: false, limit: 10 },
      });
    renderHarness();

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    );
    await user.click(screen.getByRole('button', { name: 'load more' }));

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('2'),
    );
    expect(listMyBookings).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );
  });
});
