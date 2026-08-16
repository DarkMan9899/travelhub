import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCancelBookingMutation } from './useCancelBookingMutation.js';
import { cancelBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/bookings.js', () => ({
  cancelBooking: vi.fn(),
}));

function Harness({ id }) {
  const { mutate, isSuccess } = useCancelBookingMutation(id);
  return (
    <div>
      <button type="button" onClick={() => mutate('Change of plans')}>
        cancel
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

Harness.propTypes = { id: PropTypes.number.isRequired };

describe('useCancelBookingMutation (apps/web/src/modules/bookings)', () => {
  let queryClient;

  beforeEach(() => {
    cancelBooking.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls cancelBooking with the id/reason and invalidates detail + lists caches', async () => {
    cancelBooking.mockResolvedValue({
      data: { id: 9, status: 'CANCELLED_BY_CUSTOMER' },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness id={9} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'cancel' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(cancelBooking).toHaveBeenCalledWith(9, 'Change of plans');
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.detail(9),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.lists(),
    });
  });
});
