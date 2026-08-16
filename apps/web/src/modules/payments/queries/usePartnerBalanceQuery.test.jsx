import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PropTypes from 'prop-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePartnerBalanceQuery } from './usePartnerBalanceQuery.js';
import { getPartnerBalance } from '../../../api/payments.js';

vi.mock('../../../api/payments.js', () => ({
  getPartnerBalance: vi.fn(),
}));

function Harness({ partnerId = undefined }) {
  const { data, isPending } = usePartnerBalanceQuery(partnerId);
  return (
    <div>
      <p data-testid="status">{isPending ? 'pending' : 'success'}</p>
      <p data-testid="count">{data?.balances?.length ?? 0}</p>
    </div>
  );
}

Harness.propTypes = { partnerId: PropTypes.number };

function renderHarness(partnerId) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness partnerId={partnerId} />
    </QueryClientProvider>,
  );
}

describe('usePartnerBalanceQuery (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    getPartnerBalance.mockReset();
  });

  test('resolves the payable balance for a partner', async () => {
    getPartnerBalance.mockResolvedValue({
      data: { balances: [{ currency: 'AMD', balance: '10000.00' }] },
    });
    renderHarness(4);

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('success'),
    );
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(getPartnerBalance).toHaveBeenCalledWith(4);
  });

  test('stays disabled (never calls the API) when no partnerId is selected yet', () => {
    renderHarness(undefined);
    expect(getPartnerBalance).not.toHaveBeenCalled();
  });
});
