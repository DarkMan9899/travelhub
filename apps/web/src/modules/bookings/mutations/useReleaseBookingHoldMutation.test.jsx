import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReleaseBookingHoldMutation } from './useReleaseBookingHoldMutation.js';
import { releaseBookingHolds } from '../../../api/bookingHolds.js';

vi.mock('../../../api/bookingHolds.js', () => ({
  releaseBookingHolds: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useReleaseBookingHoldMutation();
  return (
    <div>
      <button type="button" onClick={() => mutate([1, 2])}>
        release
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useReleaseBookingHoldMutation (apps/web/src/modules/bookings)', () => {
  let queryClient;

  beforeEach(() => {
    releaseBookingHolds.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls releaseBookingHolds with the requested hold ids', async () => {
    releaseBookingHolds.mockResolvedValue({ data: { released: true } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'release' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(releaseBookingHolds).toHaveBeenCalledWith([1, 2]);
  });
});
