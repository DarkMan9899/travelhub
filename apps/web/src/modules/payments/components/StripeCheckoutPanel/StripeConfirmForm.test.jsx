import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useStripe, useElements } from '@stripe/react-stripe-js';
import StripeConfirmForm from './StripeConfirmForm.jsx';

const confirmPayment = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  useStripe: vi.fn(),
  useElements: vi.fn(),
  PaymentElement: () => <div>PaymentElement</div>,
}));

function setStripeReady(ready) {
  useStripe.mockReturnValue(ready ? { confirmPayment } : null);
  useElements.mockReturnValue(ready ? {} : null);
}

describe('StripeConfirmForm (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    confirmPayment.mockReset();
    setStripeReady(true);
  });

  test('renders the PaymentElement and a disabled confirm button until Stripe.js has loaded', () => {
    setStripeReady(false);
    render(
      <StripeConfirmForm
        returnUrl="https://example.com/booking/1"
        onOutcome={vi.fn()}
      />,
    );
    expect(screen.getByText('PaymentElement')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('submits via stripe.confirmPayment with redirect:"if_required" and the given return_url, then reports the resulting PaymentIntent status', async () => {
    confirmPayment.mockResolvedValue({
      paymentIntent: { status: 'requires_capture' },
    });
    const onOutcome = vi.fn();
    const user = userEvent.setup();
    render(
      <StripeConfirmForm
        returnUrl="https://example.com/booking/1"
        onOutcome={onOutcome}
      />,
    );

    await user.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(confirmPayment).toHaveBeenCalledWith({
        elements: {},
        confirmParams: { return_url: 'https://example.com/booking/1' },
        redirect: 'if_required',
      }),
    );
    expect(onOutcome).toHaveBeenCalledWith('requires_capture');
  });

  test('a declined/failed confirmation shows the error inline and never calls onOutcome — the same form stays mounted for a retry', async () => {
    confirmPayment.mockResolvedValue({
      error: { message: 'Your card was declined.' },
    });
    const onOutcome = vi.fn();
    const user = userEvent.setup();
    render(
      <StripeConfirmForm
        returnUrl="https://example.com/booking/1"
        onOutcome={onOutcome}
      />,
    );

    await user.click(screen.getByRole('button'));

    expect(
      await screen.findByText('Your card was declined.'),
    ).toBeInTheDocument();
    expect(onOutcome).not.toHaveBeenCalled();
    // Retryable: the PaymentElement and confirm button are still there.
    expect(screen.getByText('PaymentElement')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeEnabled();
  });

  test('a retry after a decline calls confirmPayment again', async () => {
    confirmPayment
      .mockResolvedValueOnce({ error: { message: 'Card declined.' } })
      .mockResolvedValueOnce({
        paymentIntent: { status: 'requires_capture' },
      });
    const onOutcome = vi.fn();
    const user = userEvent.setup();
    render(
      <StripeConfirmForm
        returnUrl="https://example.com/booking/1"
        onOutcome={onOutcome}
      />,
    );

    await user.click(screen.getByRole('button'));
    await screen.findByText('Card declined.');
    await user.click(screen.getByRole('button'));

    await waitFor(() => expect(confirmPayment).toHaveBeenCalledTimes(2));
    expect(onOutcome).toHaveBeenCalledWith('requires_capture');
  });
});
