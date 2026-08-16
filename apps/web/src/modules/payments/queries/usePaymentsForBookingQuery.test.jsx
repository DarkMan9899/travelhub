import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaymentsForBookingQuery } from './usePaymentsForBookingQuery.js';
import { listPayments } from '../../../api/payments.js';

vi.mock('../../../api/payments.js', () => ({
  listPayments: vi.fn(),
}));

function Harness({ bookingId = undefined }) {
  const { data, isPending } = usePaymentsForBookingQuery(bookingId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="count">{data?.length ?? 0}</p>
    </div>
  );
}

Harness.propTypes = { bookingId: PropTypes.number };

function renderHarness(bookingId) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness bookingId={bookingId} />
    </QueryClientProvider>,
  );
}

describe('usePaymentsForBookingQuery (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    listPayments.mockReset();
  });

  test('resolves the payments list scoped to one booking', async () => {
    listPayments.mockResolvedValue({
      data: [{ id: 1, status: 'SUCCEEDED' }],
    });
    renderHarness(7);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(listPayments).toHaveBeenCalledWith({ bookingId: 7, limit: 20 });
  });

  test('stays disabled (never calls the API) when no bookingId is selected yet', () => {
    renderHarness(undefined);
    expect(listPayments).not.toHaveBeenCalled();
  });
});
