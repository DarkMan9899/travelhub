import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateBookingMutation } from './useCreateBookingMutation.js';
import { createBooking } from '../../../api/bookings.js';
import bookingKeys from '../constants/queryKeys.js';

vi.mock('../../../api/bookings.js', () => ({
  createBooking: vi.fn(),
}));

function Harness({ payload }) {
  const { mutate, data, isSuccess } = useCreateBookingMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate(payload)}>
        confirm
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
      <p data-testid="reference">{data?.data?.booking_reference ?? ''}</p>
    </div>
  );
}

// eslint-disable-next-line react/forbid-prop-types -- test harness forwards an arbitrary payload shape
Harness.propTypes = { payload: PropTypes.object.isRequired };

describe('useCreateBookingMutation (apps/web/src/modules/bookings)', () => {
  let queryClient;

  beforeEach(() => {
    createBooking.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls createBooking with the payload and invalidates the lists cache', async () => {
    createBooking.mockResolvedValue({
      data: { id: 1, booking_reference: 'BK-20260101-ABCDEF23' },
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    const payload = {
      items: [{ holdIds: [1] }],
      guestContactSnapshot: { fullName: 'Ana Smith', email: 'ana@example.com' },
    };

    render(
      <QueryClientProvider client={queryClient}>
        <Harness payload={payload} />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'confirm' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(createBooking).toHaveBeenCalledWith(payload);
    expect(screen.getByTestId('reference')).toHaveTextContent(
      'BK-20260101-ABCDEF23',
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: bookingKeys.lists(),
    });
  });
});
