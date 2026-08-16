import { describe, test, expect } from '@jest/globals';
import { PaymentProviderRegistry } from '../../../../../src/modules/payments/providers/paymentProviderRegistry.js';
import { ExternalServiceError } from '../../../../../src/errors/AppError.js';

const PAYMENTS_CONFIG = {
  defaultProvider: 'local',
  stripe: { secretKey: '', webhookSecret: '', apiVersion: '2024-06-20' },
};

describe('PaymentProviderRegistry', () => {
  test('registers both providers by their own .code', () => {
    const registry = new PaymentProviderRegistry({
      paymentsConfig: PAYMENTS_CONFIG,
    });
    expect(registry.getProvider('local').code).toBe('local');
    expect(registry.getProvider('stripe').code).toBe('stripe');
  });

  test('getDefaultProvider resolves "local" by default — the only provider enabled without external credentials', () => {
    const registry = new PaymentProviderRegistry({
      paymentsConfig: PAYMENTS_CONFIG,
    });
    expect(registry.getDefaultProvider().code).toBe('local');
    expect(registry.getDefaultProvider().isConfigured).toBe(true);
  });

  test('getProvider throws ExternalServiceError for an unknown code', () => {
    const registry = new PaymentProviderRegistry({
      paymentsConfig: PAYMENTS_CONFIG,
    });
    expect(() => registry.getProvider('does-not-exist')).toThrow(
      ExternalServiceError,
    );
  });

  test('selecting stripe without a secret key fails at call time, not at construction', async () => {
    const registry = new PaymentProviderRegistry({
      paymentsConfig: { ...PAYMENTS_CONFIG, defaultProvider: 'stripe' },
    });
    const provider = registry.getDefaultProvider();
    expect(provider.code).toBe('stripe');
    expect(provider.isConfigured).toBe(false);
    await expect(
      provider.createPaymentIntent({
        amount: '10.00',
        currencyCode: 'AMD',
        paymentReference: 'PAY-1',
        bookingId: 1,
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
