import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreatePaymentMutation } from './useCreatePaymentMutation.js';
import { createPayment } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

vi.mock('../../../api/payments.js', () => ({
  createPayment: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useCreatePaymentMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() => mutate({ bookingId: 9, simulateScenario: 'SUCCESS' })}
      >
        pay now
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useCreatePaymentMutation (apps/web/src/modules/payments)', () => {
  let queryClient;

  beforeEach(() => {
    createPayment.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls createPayment with a generated idempotency key and invalidates booking + list caches', async () => {
    createPayment.mockResolvedValue({ data: { id: 3, status: 'SUCCEEDED' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'pay now' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(createPayment).toHaveBeenCalledWith({
      bookingId: 9,
      simulateScenario: 'SUCCESS',
      idempotencyKey: expect.any(String),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentKeys.forBooking(9),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentKeys.lists(),
    });
  });
});
