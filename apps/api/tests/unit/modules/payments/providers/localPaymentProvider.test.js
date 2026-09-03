import { describe, test, expect } from '@jest/globals';
import { LocalPaymentProvider } from '../../../../../src/modules/payments/providers/localPaymentProvider.js';

describe('LocalPaymentProvider', () => {
  test('code is "local" and it is always configured (no external credentials needed)', () => {
    const provider = new LocalPaymentProvider();
    expect(provider.code).toBe('local');
    expect(provider.isConfigured).toBe(true);
  });

  test('createPaymentIntent defaults to the SUCCESS scenario when none is specified, resolving to AUTHORIZED (manual capture)', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.createPaymentIntent({
      amount: '100.00',
      currencyCode: 'AMD',
    });
    expect(result.status).toBe('AUTHORIZED');
    expect(result.providerPaymentId).toMatch(/^local_pi_/);
    expect(result.raw.simulated).toBe(true);
  });

  test('capturePayment resolves an AUTHORIZED payment to SUCCEEDED', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.capturePayment('local_pi_x', {
      amount: '100.00',
    });
    expect(result.status).toBe('SUCCEEDED');
  });

  test('createPaymentIntent honors an explicit DECLINE scenario', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.createPaymentIntent({
      amount: '100.00',
      currencyCode: 'AMD',
      metadata: { simulateScenario: 'DECLINE' },
    });
    expect(result.status).toBe('FAILED');
    expect(result.failureCode).toBe('card_declined');
    expect(result.failureMessage).toMatch(/Development\/Demo Payment/);
  });

  test('createPaymentIntent honors an explicit PROCESSING scenario', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.createPaymentIntent({
      amount: '100.00',
      currencyCode: 'AMD',
      metadata: { simulateScenario: 'PROCESSING' },
    });
    expect(result.status).toBe('PROCESSING');
  });

  test('createPaymentIntent honors an explicit REQUIRES_ACTION scenario', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.createPaymentIntent({
      amount: '100.00',
      currencyCode: 'AMD',
      metadata: { simulateScenario: 'REQUIRES_ACTION' },
    });
    expect(result.status).toBe('REQUIRES_ACTION');
  });

  test('an invalid/unknown scenario falls back to SUCCESS rather than throwing', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.createPaymentIntent({
      amount: '100.00',
      currencyCode: 'AMD',
      metadata: { simulateScenario: 'NOT_A_REAL_SCENARIO' },
    });
    expect(result.status).toBe('AUTHORIZED');
  });

  test('cancelPayment resolves to CANCELLED', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.cancelPayment('local_pi_x');
    expect(result.status).toBe('CANCELLED');
  });

  test('refundPayment always simulates success and never moves real money', async () => {
    const provider = new LocalPaymentProvider();
    const result = await provider.refundPayment('local_pi_x', {
      amount: '50.00',
      currencyCode: 'AMD',
      reason: 'customer request',
    });
    expect(result.status).toBe('SUCCEEDED');
    expect(result.providerRefundId).toMatch(/^local_re_/);
    expect(result.raw.simulated).toBe(true);
  });

  test('verifyWebhook always returns true (no real signature for a simulated provider)', async () => {
    const provider = new LocalPaymentProvider();
    await expect(
      provider.verifyWebhook({ rawBody: '{}', signatureHeader: null }),
    ).resolves.toBe(true);
  });

  test('normalizeWebhookEvent passes through the already-normalized local event shape', () => {
    const provider = new LocalPaymentProvider();
    const normalized = provider.normalizeWebhookEvent({
      id: 'local_evt_1',
      type: 'local.payment.succeeded',
      providerPaymentId: 'local_pi_x',
      status: 'SUCCEEDED',
    });
    expect(normalized).toEqual({
      kind: 'payment',
      providerEventId: 'local_evt_1',
      eventType: 'local.payment.succeeded',
      normalizedEventType: 'local.payment.succeeded',
      providerPaymentId: 'local_pi_x',
      status: 'SUCCEEDED',
    });
  });
});
