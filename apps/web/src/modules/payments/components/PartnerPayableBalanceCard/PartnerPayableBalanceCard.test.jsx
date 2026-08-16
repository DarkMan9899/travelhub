import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PartnerPayableBalanceCard from './PartnerPayableBalanceCard.jsx';
import { getPartnerBalance } from '../../../../api/payments.js';

vi.mock('../../../../api/payments.js', () => ({
  getPartnerBalance: vi.fn(),
}));

function renderCard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PartnerPayableBalanceCard partnerId={4} />
    </QueryClientProvider>,
  );
}

describe('PartnerPayableBalanceCard (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    getPartnerBalance.mockReset();
  });

  test('renders the payable balance per currency', async () => {
    getPartnerBalance.mockResolvedValue({
      data: { balances: [{ currency: 'AMD', balance: '15000.00' }] },
    });
    renderCard();
    expect(await screen.findByText('Ձեզ վճարման ենթակա')).toBeInTheDocument();
  });

  test('shows an empty state when there is no payable balance yet', async () => {
    getPartnerBalance.mockResolvedValue({ data: { balances: [] } });
    renderCard();
    expect(
      await screen.findByText('Դեռ վճարման ենթակա մնացորդ չկա։'),
    ).toBeInTheDocument();
  });

  test('shows an error message when the request fails', async () => {
    getPartnerBalance.mockRejectedValue(new Error('boom'));
    renderCard();
    expect(
      await screen.findByText('Չհաջողվեց բեռնել ձեր վճարման ենթակա մնացորդը։'),
    ).toBeInTheDocument();
  });
});
