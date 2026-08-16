import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMyListingsQuery } from './useMyListingsQuery.js';
import { searchListings } from '../../../api/search.js';

vi.mock('../../../api/search.js', () => ({
  searchListings: vi.fn(),
}));

function queryStatus(isPending, isError) {
  if (isPending) return 'pending';
  if (isError) return 'error';
  return 'success';
}

function Harness({ partnerId = undefined, status = undefined }) {
  const { data, isPending, isError, hasNextPage, fetchNextPage } =
    useMyListingsQuery({ partnerId, status });
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

Harness.propTypes = {
  partnerId: PropTypes.number,
  status: PropTypes.string,
};

function renderHarness({ partnerId, status } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness partnerId={partnerId} status={status} />
    </QueryClientProvider>,
  );
}

describe('useMyListingsQuery (apps/web/src/modules/listings)', () => {
  beforeEach(() => {
    searchListings.mockReset();
  });

  test('resolves the first page of a partner own listings', async () => {
    searchListings.mockResolvedValue({
      data: [{ id: 1, title: 'Seaside Villa', status: 'DRAFT' }],
      meta: { next_cursor: null, has_more: false, limit: 10 },
    });
    renderHarness({ partnerId: 3 });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(searchListings).toHaveBeenCalledWith(
      expect.objectContaining({ partnerId: 3, limit: 10 }),
    );
  });

  test('forwards the status filter when provided', async () => {
    searchListings.mockResolvedValue({
      data: [],
      meta: { next_cursor: null, has_more: false, limit: 10 },
    });
    renderHarness({ partnerId: 3, status: 'PUBLISHED' });

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(searchListings).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PUBLISHED' }),
    );
  });

  test('does not fetch when no partnerId is given', () => {
    renderHarness({ partnerId: undefined });
    expect(searchListings).not.toHaveBeenCalled();
  });

  test('fetchNextPage appends the next cursor page', async () => {
    const user = userEvent.setup();
    searchListings
      .mockResolvedValueOnce({
        data: [{ id: 1 }],
        meta: { next_cursor: 'cursor-1', has_more: true, limit: 10 },
      })
      .mockResolvedValueOnce({
        data: [{ id: 2 }],
        meta: { next_cursor: null, has_more: false, limit: 10 },
      });
    renderHarness({ partnerId: 3 });

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('1'),
    );
    await user.click(screen.getByRole('button', { name: 'load more' }));

    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('2'),
    );
    expect(searchListings).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1' }),
    );
  });
});
