import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConfirmBookingMutation } from './useConfirmBookingMutation.js';
import { confirmBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/bookings.js', () => ({
  confirmBooking: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useConfirmBookingMutation(7);
  return (
    <div>
      <button type="button" onClick={() => mutate()}>
        confirm
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useConfirmBookingMutation (apps/web/src/modules/bookings)', () => {
  let queryClient;

  beforeEach(() => {
    confirmBooking.mockReset();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  test('calls confirmBooking(id) and invalidates detail + lists caches', async () => {
    confirmBooking.mockResolvedValue({ data: { id: 7, status: 'CONFIRMED' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(confirmBooking).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.detail(7),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.lists(),
    });
  });
});
