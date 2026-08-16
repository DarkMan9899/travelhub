import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRejectBookingMutation } from './useRejectBookingMutation.js';
import { rejectBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/bookings.js', () => ({
  rejectBooking: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useRejectBookingMutation(7);
  return (
    <div>
      <button type="button" onClick={() => mutate('Fully booked')}>
        reject
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useRejectBookingMutation (apps/web/src/modules/bookings)', () => {
  let queryClient;

  beforeEach(() => {
    rejectBooking.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls rejectBooking(id, reason) and invalidates detail + lists caches', async () => {
    rejectBooking.mockResolvedValue({ data: { id: 7, status: 'REJECTED' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'reject' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(rejectBooking).toHaveBeenCalledWith(7, 'Fully booked');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.detail(7),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.lists(),
    });
  });
});
