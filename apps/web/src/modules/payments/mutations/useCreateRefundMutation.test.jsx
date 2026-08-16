import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateRefundMutation } from './useCreateRefundMutation.js';
import { createRefund } from '../../../api/payments.js';
import paymentKeys from '../constants/queryKeys.js';

vi.mock('../../../api/payments.js', () => ({
  createRefund: vi.fn(),
}));

function Harness() {
  const { mutate, isSuccess } = useCreateRefundMutation();
  return (
    <div>
      <button
        type="button"
        onClick={() =>
          mutate({ paymentId: 3, amount: '5000.00', reason: 'Guest request' })
        }
      >
        refund
      </button>
      <p data-testid="status">{isSuccess ? 'success' : 'idle'}</p>
    </div>
  );
}

describe('useCreateRefundMutation (apps/web/src/modules/payments)', () => {
  let queryClient;

  beforeEach(() => {
    createRefund.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });

  test('calls createRefund with a generated idempotency key and invalidates payment + all caches', async () => {
    createRefund.mockResolvedValue({ data: { id: 1, status: 'SUCCEEDED' } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'refund' }));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(createRefund).toHaveBeenCalledWith(3, {
      amount: '5000.00',
      reason: 'Guest request',
      idempotencyKey: expect.any(String),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentKeys.detail(3),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: paymentKeys.all,
    });
  });
});
