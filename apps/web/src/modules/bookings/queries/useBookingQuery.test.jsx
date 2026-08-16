import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBookingQuery } from './useBookingQuery.js';
import { getBooking } from '../../../api/bookings.js';

vi.mock('../../../api/bookings.js', () => ({
  getBooking: vi.fn(),
}));

function Harness({ id = undefined }) {
  const { data, isPending } = useBookingQuery(id);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="reference">{data?.booking_reference ?? ''}</p>
    </div>
  );
}

Harness.propTypes = { id: PropTypes.number };

function renderHarness(id) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness id={id} />
    </QueryClientProvider>,
  );
}

describe('useBookingQuery (apps/web/src/modules/bookings)', () => {
  beforeEach(() => {
    getBooking.mockReset();
  });

  test('resolves a single booking by id', async () => {
    getBooking.mockResolvedValue({
      data: { id: 5, booking_reference: 'BK-20260101-ABCDEF23' },
    });
    renderHarness(5);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('reference')).toHaveTextContent(
      'BK-20260101-ABCDEF23',
    );
    expect(getBooking).toHaveBeenCalledWith(5);
  });

  test('stays disabled (never calls the API) when no id is selected yet', () => {
    renderHarness(undefined);
    expect(getBooking).not.toHaveBeenCalled();
  });
});
