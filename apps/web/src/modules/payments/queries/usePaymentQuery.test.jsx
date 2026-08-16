import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaymentQuery } from './usePaymentQuery.js';
import { getPayment } from '../../../api/payments.js';

vi.mock('../../../api/payments.js', () => ({
  getPayment: vi.fn(),
}));

function Harness({ id = undefined }) {
  const { data, isPending } = usePaymentQuery(id);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="reference">{data?.payment_reference ?? ''}</p>
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

describe('usePaymentQuery (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    getPayment.mockReset();
  });

  test('resolves a single payment by id', async () => {
    getPayment.mockResolvedValue({
      data: { id: 3, payment_reference: 'PAY-20260101-ABCDEF23' },
    });
    renderHarness(3);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('reference')).toHaveTextContent(
      'PAY-20260101-ABCDEF23',
    );
    expect(getPayment).toHaveBeenCalledWith(3);
  });

  test('stays disabled (never calls the API) when no id is selected yet', () => {
    renderHarness(undefined);
    expect(getPayment).not.toHaveBeenCalled();
  });
});
