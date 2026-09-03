import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ToastProvider from '../../../../providers/ToastProvider.jsx';
import StripeCheckoutPanel from './StripeCheckoutPanel.jsx';
import { createPayment } from '../../../../api/payments.js';
import { getStripe } from '../../stripe/getStripe.js';

vi.mock('../../../../api/payments.js', () => ({
  createPayment: vi.fn(),
}));
vi.mock('../../stripe/getStripe.js', () => ({
  getStripe: vi.fn(),
}));
vi.mock('@stripe/react-stripe-js', () => ({
  // eslint-disable-next-line react/prop-types -- test-only passthrough mock
  Elements: ({ children }) => <div data-testid="elements">{children}</div>,
}));
vi.mock('./StripeConfirmForm.jsx', () => ({
  default: ({ onOutcome }) => (
    <button type="button" onClick={() => onOutcome('requires_capture')}>
      StripeConfirmForm
    </button>
  ),
}));

const BOOKING = { id: 12, total_amount: '65000.00', currency: 'AMD' };

function renderPanel(onPaid) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <StripeCheckoutPanel
          booking={BOOKING}
          stripePublishableKey="pk_test_dummy"
          onPaid={onPaid}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('StripeCheckoutPanel (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    createPayment.mockReset();
    getStripe.mockReset();
    getStripe.mockReturnValue(Promise.resolve({ mocked: true }));
    // A same-origin relative path — jsdom's `replaceState` (matching real
    // browsers) refuses to change origin, so this must never be an
    // absolute cross-origin URL.
    window.history.replaceState({}, '', '/en/account/bookings/12');
  });

  test('go-live sequencing: shows only a "Pay Now" button and never calls getStripe/loadStripe until it is clicked', () => {
    renderPanel();
    expect(
      screen.getByRole('button', { name: 'Վճարել հիմա' }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('elements')).not.toBeInTheDocument();
    expect(getStripe).not.toHaveBeenCalled();
  });

  test('clicking "Pay Now" creates the PaymentIntent (bookingId only — never an amount/currency) and then mounts the Stripe Elements form', async () => {
    createPayment.mockResolvedValue({
      data: { id: 99, client_secret: 'pi_123_secret_abc' },
    });
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Վճարել հիմա' }));

    await waitFor(() =>
      expect(createPayment).toHaveBeenCalledWith(
        expect.objectContaining({ bookingId: 12 }),
      ),
    );
    const [sentPayload] = createPayment.mock.calls[0];
    expect(sentPayload).not.toHaveProperty('amount');
    expect(sentPayload).not.toHaveProperty('currency');
    expect(getStripe).toHaveBeenCalledWith('pk_test_dummy');
    expect(await screen.findByTestId('elements')).toBeInTheDocument();
    expect(screen.getByText('StripeConfirmForm')).toBeInTheDocument();
  });

  test('a successful confirmation (requires_capture) notifies via onPaid', async () => {
    createPayment.mockResolvedValue({
      data: { id: 99, client_secret: 'pi_123_secret_abc' },
    });
    const onPaid = vi.fn();
    const user = userEvent.setup();
    renderPanel(onPaid);

    await user.click(screen.getByRole('button', { name: 'Վճարել հիմա' }));
    await screen.findByText('StripeConfirmForm');
    await user.click(screen.getByText('StripeConfirmForm'));

    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  test('a failed PaymentIntent creation shows an error toast rather than a broken/blank checkout form', async () => {
    createPayment.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Վճարել հիմա' }));

    expect(
      await screen.findByText(
        'Չհաջողվեց մշակել այս վճարումը։ Խնդրում ենք կրկին փորձել։',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('elements')).not.toBeInTheDocument();
  });
});
