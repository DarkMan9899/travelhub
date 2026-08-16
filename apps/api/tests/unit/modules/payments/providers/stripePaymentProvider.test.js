import { createHmac } from 'node:crypto';
import { describe, test, expect, jest } from '@jest/globals';
import { StripePaymentProvider } from '../../../../../src/modules/payments/providers/stripePaymentProvider.js';
import { ExternalServiceError } from '../../../../../src/errors/AppError.js';

describe('StripePaymentProvider', () => {
  test('code is "stripe"; isConfigured is false without a secret key', () => {
    const unconfigured = new StripePaymentProvider({ secretKey: '' });
    expect(unconfigured.code).toBe('stripe');
    expect(unconfigured.isConfigured).toBe(false);

    const configured = new StripePaymentProvider({ secretKey: 'sk_test_x' });
    expect(configured.isConfigured).toBe(true);
  });

  test('createPaymentIntent throws ExternalServiceError when no secret key is configured', async () => {
    const provider = new StripePaymentProvider({ secretKey: '' });
    await expect(
      provider.createPaymentIntent({
        amount: '100.00',
        currencyCode: 'AMD',
        paymentReference: 'PAY-1',
        bookingId: 1,
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test('createPaymentIntent maps a successful Stripe response and never sends a JSON body (form-encoded)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'pi_123', status: 'succeeded' }),
    });
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      apiVersion: '2024-06-20',
      fetchImpl,
    });
    const result = await provider.createPaymentIntent({
      amount: '105.50',
      currencyCode: 'AMD',
      paymentReference: 'PAY-1',
      bookingId: 42,
    });
    expect(result).toEqual({
      providerPaymentId: 'pi_123',
      status: 'SUCCEEDED',
      raw: { id: 'pi_123', status: 'succeeded' },
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/payment_intents');
    expect(options.headers.Authorization).toBe('Bearer sk_test_x');
    expect(options.headers['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    );
    // Minor-units transform: "105.50" -> "10550", never a float multiply.
    expect(options.body).toContain('amount=10550');
    expect(options.body).toContain('currency=amd');
  });

  test('createPaymentIntent throws ExternalServiceError on a non-OK response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ error: { message: 'Your card was declined.' } }),
    });
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      fetchImpl,
    });
    await expect(
      provider.createPaymentIntent({
        amount: '100.00',
        currencyCode: 'AMD',
        paymentReference: 'PAY-1',
        bookingId: 1,
      }),
    ).rejects.toThrow('Your card was declined.');
  });

  test('createPaymentIntent throws ExternalServiceError when the network call itself fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      fetchImpl,
    });
    await expect(
      provider.createPaymentIntent({
        amount: '100.00',
        currencyCode: 'AMD',
        paymentReference: 'PAY-1',
        bookingId: 1,
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  test("every Stripe payment_intent status maps to this app's own normalized vocabulary", async () => {
    const cases = [
      ['requires_payment_method', 'CREATED'],
      ['requires_confirmation', 'CREATED'],
      ['requires_action', 'REQUIRES_ACTION'],
      ['processing', 'PROCESSING'],
      ['requires_capture', 'AUTHORIZED'],
      ['succeeded', 'SUCCEEDED'],
      ['canceled', 'CANCELLED'],
    ];
    // eslint-disable-next-line no-restricted-syntax -- sequential is clearer here
    for (const [stripeStatus, normalized] of cases) {
      const fetchImpl = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'pi_1', status: stripeStatus }),
      });
      const provider = new StripePaymentProvider({
        secretKey: 'sk_test_x',
        fetchImpl,
      });
      // eslint-disable-next-line no-await-in-loop -- sequential is clearer here
      const result = await provider.retrievePayment('pi_1');
      expect(result.status).toBe(normalized);
    }
  });

  test('refundPayment sends the payment_intent + amount and maps a successful refund', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_123', status: 'succeeded' }),
    });
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      fetchImpl,
    });
    const result = await provider.refundPayment('pi_123', {
      amount: '50.00',
      reason: 'customer request',
    });
    expect(result).toEqual({
      providerRefundId: 're_123',
      status: 'SUCCEEDED',
      raw: { id: 're_123', status: 'succeeded' },
    });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.stripe.com/v1/refunds');
    expect(options.body).toContain('payment_intent=pi_123');
    expect(options.body).toContain('amount=5000');
  });

  test('verifyWebhook: a correctly-signed payload verifies true', async () => {
    const webhookSecret = 'whsec_test';
    const rawBody = JSON.stringify({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
    });
    const timestamp = '1700000000';
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      webhookSecret,
    });
    const verified = await provider.verifyWebhook({
      rawBody,
      signatureHeader: `t=${timestamp},v1=${signature}`,
    });
    expect(verified).toBe(true);
  });

  test('verifyWebhook: a tampered payload fails verification', async () => {
    const webhookSecret = 'whsec_test';
    const rawBody = JSON.stringify({ id: 'evt_1' });
    const timestamp = '1700000000';
    const signature = createHmac('sha256', webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      webhookSecret,
    });
    const verified = await provider.verifyWebhook({
      rawBody: JSON.stringify({ id: 'evt_1_TAMPERED' }),
      signatureHeader: `t=${timestamp},v1=${signature}`,
    });
    expect(verified).toBe(false);
  });

  test('verifyWebhook: missing signature header or webhook secret fails closed', async () => {
    const provider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      webhookSecret: 'whsec_test',
    });
    await expect(
      provider.verifyWebhook({ rawBody: '{}', signatureHeader: null }),
    ).resolves.toBe(false);

    const noSecretProvider = new StripePaymentProvider({
      secretKey: 'sk_test_x',
      webhookSecret: '',
    });
    await expect(
      noSecretProvider.verifyWebhook({
        rawBody: '{}',
        signatureHeader: 't=1,v1=abc',
      }),
    ).resolves.toBe(false);
  });

  test('normalizeWebhookEvent maps a Stripe event envelope into the normalized shape', () => {
    const provider = new StripePaymentProvider({ secretKey: 'sk_test_x' });
    const normalized = provider.normalizeWebhookEvent({
      id: 'evt_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_123', status: 'succeeded' } },
    });
    expect(normalized).toEqual({
      providerEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      normalizedEventType: 'payment_intent.succeeded',
      providerPaymentId: 'pi_123',
      status: 'SUCCEEDED',
    });
  });
});
