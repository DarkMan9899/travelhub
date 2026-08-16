import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyPaymentsPageContent from './MyPaymentsPageContent.jsx';
import { listPayments } from '../../../../api/payments.js';

vi.mock('../../../../api/payments.js', () => ({
  listPayments: vi.fn(),
}));

const PAYMENT_ROW = {
  id: 1,
  payment_reference: 'PAY-20260101-ABCDEF23',
  booking_id: 7,
  status: 'SUCCEEDED',
  currency: 'AMD',
  total_amount: '85000.00',
  created_at: '2026-07-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/hy']}>
        <Routes>
          <Route path="/:locale" element={<MyPaymentsPageContent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MyPaymentsPageContent (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    listPayments.mockReset();
  });

  test('renders a card per payment', async () => {
    listPayments.mockResolvedValue({
      data: [PAYMENT_ROW],
      meta: { next_cursor: null },
    });
    renderPage();
    expect(
      await screen.findByText('PAY-20260101-ABCDEF23'),
    ).toBeInTheDocument();
  });

  test('shows an empty state when there are no payments yet', async () => {
    listPayments.mockResolvedValue({ data: [], meta: { next_cursor: null } });
    renderPage();
    expect(await screen.findByText('Դեռ վճարումներ չկան')).toBeInTheDocument();
  });

  test('shows a retryable error state when the request fails', async () => {
    listPayments.mockRejectedValue(new Error('boom'));
    renderPage();
    expect(
      await screen.findByText('Չհաջողվեց բեռնել ձեր վճարումները։'),
    ).toBeInTheDocument();
  });
});
