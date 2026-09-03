/**
 * StripeConfirmForm — the actual card-entry + confirm step, mounted only
 * once a `client_secret` exists (`StripeCheckoutPanel`'s child, inside
 * `<Elements>`). `stripe.confirmPayment` handles SCA/3DS itself: for
 * payment methods where the challenge can be shown in-page (the common
 * card case), `redirect: 'if_required'` resolves this promise directly
 * once the challenge completes, with no navigation; for a payment method
 * that genuinely requires leaving the page, Stripe redirects to
 * `return_url` and `StripeCheckoutPanel`'s own return-handling effect
 * picks the outcome back up from the URL. A declined/failed confirmation
 * resolves with `{ error }` — the SAME `<PaymentElement>` stays mounted so
 * the customer can simply retry with a different method, no new
 * PaymentIntent needed.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import {
  useStripe,
  useElements,
  PaymentElement,
} from '@stripe/react-stripe-js';
import { Button } from '@desavii/ui/components/primitives';
import { Stack } from '@desavii/ui/components/layout';
import { Alert } from '@desavii/ui/components/feedback-overlays';

export default function StripeConfirmForm({ returnUrl, onOutcome }) {
  const { t } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    });

    setSubmitting(false);
    if (error) {
      setErrorMessage(error.message ?? t('payments.payNow.errorToast'));
      return;
    }
    onOutcome(paymentIntent?.status);
  }

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="4">
        <PaymentElement />
        {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={!stripe || !elements}
        >
          {t('payments.payNow.confirmAction')}
        </Button>
      </Stack>
    </form>
  );
}

StripeConfirmForm.propTypes = {
  returnUrl: PropTypes.string.isRequired,
  onOutcome: PropTypes.func.isRequired,
};
