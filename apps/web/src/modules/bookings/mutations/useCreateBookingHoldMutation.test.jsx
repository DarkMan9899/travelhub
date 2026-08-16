import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateBookingHoldMutation } from './useCreateBookingHoldMutation.js';
import { createBookingHolds } from '../../../api/bookingHolds.js';

vi.mock('../../../api/bookingHolds.js', () => ({
  createBookingHolds: vi.fn(),
}));

function Harness() {
  const { mutate, data, isSuccess } = useCreateBookingHoldMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutate([
            { bookableUnitId: 1, dateFrom: '2026-08-01', dateTo: '2026-08-03' },
          ])
        }
      >
        hold
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
      <p data-testid="expires">{data?.data?.expires_at ?? ''}</p>
    </div>
  );
}

describe('useCreateBookingHoldMutation (apps/web/src/modules/bookings)', () => {
  let queryClient;

  beforeEach(() => {
    createBookingHolds.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls createBookingHolds with the requested items', async () => {
    createBookingHolds.mockResolvedValue({
      data: { items: [{ hold_ids: [1] }], expires_at: '2026-08-01T00:15:00Z' },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'hold' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(createBookingHolds).toHaveBeenCalledWith([
      { bookableUnitId: 1, dateFrom: '2026-08-01', dateTo: '2026-08-03' },
    ]);
    expect(screen.getByTestId('expires')).toHaveTextContent(
      '2026-08-01T00:15:00Z',
    );
  });
});
