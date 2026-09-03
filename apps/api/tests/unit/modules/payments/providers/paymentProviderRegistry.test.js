import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { PaymentProviderRegistry } from '../../../../../src/modules/payments/providers/paymentProviderRegistry.js';
import { ExternalServiceError } from '../../../../../src/errors/AppError.js';

const PAYMENTS_CONFIG = {
  defaultProvider: 'local',
  stripe: { secretKey: '', webhookSecret: '', apiVersion: '2024-06-20' },
};

const CONFIG_MODULE_PATH = '../../../../../src/config/index.js';
const REGISTRY_MODULE_PATH =
  '../../../../../src/modules/payments/providers/paymentProviderRegistry.js';

/**
 * `stripePaymentProvider.js` imports `logger.js`, which reads
 * `config.logging.level`/`config.env` unconditionally — so a mocked
 * `config` module must still carry a minimal, complete-enough shape for
 * the logger to construct, not just the one field this test cares about.
 * `paymentsEnabled` defaults to `true` since most of these tests exercise
 * the "payments are live" scenario the original guard covered; the go-
 * live-sequencing tests below pass `false` explicitly. `stripePublishableKey`
 * defaults to a dummy present value so tests not specifically about the
 * publishable-key guard aren't incidentally tripped by it.
 */
function mockConfigModule(
  isProduction,
  paymentsEnabled = true,
  stripePublishableKey = 'pk_test_dummy',
) {
  jest.unstable_mockModule(CONFIG_MODULE_PATH, () => ({
    default: {
      isProduction,
      env: isProduction ? 'production' : 'test',
      logging: { level: 'silent' },
      payments: {
        enabled: paymentsEnabled,
        stripe: { publishableKey: stripePublishableKey },
      },
    },
  }));
}

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

describe('PaymentProviderRegistry production fail-closed guard (Stripe go-live preflight)', () => {
  // The first `describe` block's static top-of-file import already
  // loaded and cached the real (unmocked) config/registry modules before
  // any test runs — without resetting the registry first, a mock
  // registered here would never take effect for a dynamic re-import of
  // the same specifier.
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
    jest.dontMock(CONFIG_MODULE_PATH);
  });

  test('refuses to construct when NODE_ENV=production and the default provider resolves to "local"', async () => {
    mockConfigModule(true);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(() => new Registry({ paymentsConfig: PAYMENTS_CONFIG })).toThrow(
      /production/i,
    );
  });

  test('refuses to construct when NODE_ENV=production and the selected provider is unconfigured (e.g. stripe with no secret key)', async () => {
    mockConfigModule(true);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(
      () =>
        new Registry({
          paymentsConfig: { ...PAYMENTS_CONFIG, defaultProvider: 'stripe' },
        }),
    ).toThrow(/not configured/i);
  });

  test('constructs successfully when NODE_ENV=production and a real, configured provider is selected', async () => {
    mockConfigModule(true);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    const registry = new Registry({
      paymentsConfig: {
        defaultProvider: 'stripe',
        stripe: {
          secretKey: 'sk_test_dummy_never_a_real_key',
          webhookSecret: 'whsec_dummy',
          apiVersion: '2024-06-20',
        },
      },
    });
    expect(registry.getDefaultProvider().code).toBe('stripe');
  });

  test('never fires outside production — local/dev/test behavior is unaffected', async () => {
    mockConfigModule(false);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(
      () => new Registry({ paymentsConfig: PAYMENTS_CONFIG }),
    ).not.toThrow();
  });

  test('go-live sequencing: NODE_ENV=production with payments DISABLED boots successfully even though Stripe has no credentials configured', async () => {
    mockConfigModule(true, false);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(
      () =>
        new Registry({
          paymentsConfig: { ...PAYMENTS_CONFIG, defaultProvider: 'stripe' },
        }),
    ).not.toThrow();
  });

  test('go-live sequencing: NODE_ENV=production with payments DISABLED still refuses "local" as the default provider', async () => {
    mockConfigModule(true, false);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(() => new Registry({ paymentsConfig: PAYMENTS_CONFIG })).toThrow(
      /production/i,
    );
  });

  test('release-architecture requirement: "local" is never even registered in production — a successfully-constructed production registry cannot look it up at all', async () => {
    mockConfigModule(true);
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    const registry = new Registry({
      paymentsConfig: {
        defaultProvider: 'stripe',
        stripe: {
          secretKey: 'sk_test_dummy_never_a_real_key',
          webhookSecret: 'whsec_dummy',
          apiVersion: '2024-06-20',
        },
      },
    });
    const { ExternalServiceError: ProdExternalServiceError } =
      await import('../../../../../src/errors/AppError.js');
    expect(() => registry.getProvider('local')).toThrow(
      ProdExternalServiceError,
    );
  });

  test('Stripe frontend integration: NODE_ENV=production, payments ENABLED, Stripe configured but STRIPE_PUBLISHABLE_KEY missing refuses to construct', async () => {
    mockConfigModule(true, true, '');
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(
      () =>
        new Registry({
          paymentsConfig: {
            defaultProvider: 'stripe',
            stripe: {
              secretKey: 'sk_test_dummy_never_a_real_key',
              webhookSecret: 'whsec_dummy',
              apiVersion: '2024-06-20',
            },
          },
        }),
    ).toThrow(/STRIPE_PUBLISHABLE_KEY/);
  });

  test('Stripe frontend integration: NODE_ENV=production, payments DISABLED, Stripe selected with no publishable key still boots (checkout is simply unreachable while disabled)', async () => {
    mockConfigModule(true, false, '');
    const { PaymentProviderRegistry: Registry } = await import(
      REGISTRY_MODULE_PATH
    );

    expect(
      () =>
        new Registry({
          paymentsConfig: { ...PAYMENTS_CONFIG, defaultProvider: 'stripe' },
        }),
    ).not.toThrow();
  });
});
