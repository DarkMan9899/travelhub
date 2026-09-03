import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaymentsConfigQuery } from './usePaymentsConfigQuery.js';
import { getPaymentsConfig } from '../../../api/payments.js';

vi.mock('../../../api/payments.js', () => ({
  getPaymentsConfig: vi.fn(),
}));

function Harness() {
  const { data, isPending } = usePaymentsConfigQuery();
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="enabled">{String(data?.enabled ?? '')}</p>
    </div>
  );
}

function renderHarness() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>,
  );
}

describe('usePaymentsConfigQuery (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    getPaymentsConfig.mockReset();
  });

  test('resolves the payments-enabled flag', async () => {
    getPaymentsConfig.mockResolvedValue({ data: { enabled: false } });
    renderHarness();

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('enabled')).toHaveTextContent('false');
    expect(getPaymentsConfig).toHaveBeenCalled();
  });
});
