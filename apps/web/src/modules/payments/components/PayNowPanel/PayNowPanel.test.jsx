import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import PayNowPanel from './PayNowPanel.jsx';
import { createPayment } from '../../../../api/payments.js';

vi.mock('../../../../api/payments.js', () => ({
  createPayment: vi.fn(),
}));

const BOOKING = { id: 9, total_amount: '85000.00', currency: 'AMD' };

function renderPanel(onPaid) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <PayNowPanel booking={BOOKING} onPaid={onPaid} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('PayNowPanel (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    createPayment.mockReset();
  });

  test('renders the simulated-payment notice and the booking total', () => {
    renderPanel();
    expect(
      screen.getByText('Փորձնական/Ցուցադրական վճարում'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Վճարել հիմա' }),
    ).toBeInTheDocument();
  });

  test('paying with the default SUCCESS scenario calls createPayment and shows a success toast, then calls onPaid', async () => {
    createPayment.mockResolvedValue({ data: { status: 'SUCCEEDED' } });
    const onPaid = vi.fn();
    const user = userEvent.setup();
    renderPanel(onPaid);

    await user.click(screen.getByRole('button', { name: 'Վճարել հիմա' }));

    await waitFor(() =>
      expect(createPayment).toHaveBeenCalledWith({
        bookingId: 9,
        simulateScenario: 'SUCCESS',
        idempotencyKey: expect.any(String),
      }),
    );
    expect(await screen.findByText('Վճարումը հաջողվեց։')).toBeInTheDocument();
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  test('a DECLINE-scenario response shows the declined toast, not the success one', async () => {
    createPayment.mockResolvedValue({ data: { status: 'FAILED' } });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByTestId('select-trigger'));
    await user.click(screen.getByRole('option', { name: 'Մերժված վճարում' }));
    await user.click(screen.getByRole('button', { name: 'Վճարել հիմա' }));

    expect(
      await screen.findByText('Սիմուլյացված վճարումը մերժվեց։'),
    ).toBeInTheDocument();
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ simulateScenario: 'DECLINE' }),
    );
  });

  test('shows an error toast when the request itself fails', async () => {
    createPayment.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Վճարել հիմա' }));

    expect(
      await screen.findByText(
        'Չհաջողվեց մշակել այս վճարումը։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
  });
});
