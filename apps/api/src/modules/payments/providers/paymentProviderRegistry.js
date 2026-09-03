/**
 * Payment Provider Registry (Phase 16).
 *
 * Constructed once in `module.container.js` from `config.payments` —
 * mirrors `modules/ai/providers/providerRegistry.js`'s exact shape.
 * `PaymentService` is the only consumer; it never `new`s a provider
 * directly. Selecting an unregistered code, or a provider missing its
 * required configuration (e.g. Stripe with no secret key), both surface
 * as a clear `ExternalServiceError` at call time in development/test —
 * never a boot-time crash there (matches this codebase's
 * envalid-all-defaults convention).
 *
 * Stripe go-live preflight fail-closed guard, and release-architecture
 * requirement: `LocalPaymentProvider` (a pure simulator that never moves
 * real money — see its own header comment) is intentionally useful for
 * isolated automated tests and local development, but must NEVER be part
 * of the real, user-facing release path. This registry enforces that at
 * the strongest level available: in production, `LocalPaymentProvider`
 * is not merely "constructed but never selected" — it is never
 * constructed at all, so no code path in a production process can ever
 * reach it, regardless of what `PAYMENT_DEFAULT_PROVIDER` resolves to or
 * what a caller passes as a provider code.
 *
 * `#assertSafeForProduction` (called once, at the end of the constructor)
 * additionally enforces two independent rules, since the marketplace is
 * expected to launch BEFORE real payments are switched on
 * (`config.payments.enabled`, a deliberate deploy-time opt-in — see
 * config/index.js):
 *
 *   1. `PAYMENT_DEFAULT_PROVIDER` can never resolve to `"local"` in
 *      production, regardless of whether payments are enabled or
 *      disabled — a disabled deploy must still be safe from a config typo
 *      later flipping PAYMENTS_ENABLED=true onto an accidentally-
 *      simulated provider (moot in practice once Local isn't even
 *      registered, but this still fails with a clear, specific message
 *      instead of a generic "unknown provider" error).
 *   2. Only once `config.payments.enabled` is true does this registry
 *      additionally require the resolved provider to actually be
 *      configured (e.g. Stripe with a real secret key) — a production
 *      deploy with payments intentionally still OFF must be allowed to
 *      boot with no Stripe credentials present at all.
 *
 * Since this class is constructed synchronously during `app.js`'s module
 * load (via `module.container.js` -> `routes/v1.js`), which `server.js`
 * imports before calling `app.listen()`, a thrown error here crashes the
 * process before it ever starts accepting traffic — the same "loud boot
 * failure, never a silent fallback" shape as `seedDevAccounts.js`'s
 * identical `config.isProduction` guard. Never fires outside production.
 *
 * Runtime enforcement (not just this boot-time guard) lives in
 * `PaymentService#createPaymentIntent`/`#createRefund`, which refuse to
 * act at all — in any environment — while `config.payments.enabled` is
 * false, so "payments disabled" is never merely cosmetic.
 */

import config from '../../../config/index.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { LocalPaymentProvider } from './localPaymentProvider.js';
import { StripePaymentProvider } from './stripePaymentProvider.js';

export class PaymentProviderRegistry {
  #providersByCode = new Map();

  #defaultProviderCode;

  constructor({ paymentsConfig }) {
    this.#defaultProviderCode = paymentsConfig.defaultProvider;
    // Release-architecture requirement: never even instantiate the
    // simulator in a production process — see this file's header
    // comment. Development/test keep constructing it exactly as before.
    if (!config.isProduction) {
      this.#register(new LocalPaymentProvider());
    }
    this.#register(new StripePaymentProvider(paymentsConfig.stripe));
    this.#assertSafeForProduction();
  }

  #register(provider) {
    this.#providersByCode.set(provider.code, provider);
  }

  #assertSafeForProduction() {
    if (!config.isProduction) return;

    if (this.#defaultProviderCode === 'local') {
      throw new Error(
        'PaymentProviderRegistry refused to start: NODE_ENV=production but ' +
          'PAYMENT_DEFAULT_PROVIDER resolves to "local", a simulated ' +
          'provider that never moves real money and is never constructed ' +
          'in production. Set PAYMENT_DEFAULT_PROVIDER=stripe with real ' +
          'Stripe credentials before running in production.',
      );
    }

    const provider = this.getProvider(this.#defaultProviderCode);
    if (config.payments.enabled && !provider.isConfigured) {
      throw new Error(
        'PaymentProviderRegistry refused to start: NODE_ENV=production and ' +
          `PAYMENTS_ENABLED=true, but the selected payment provider ` +
          `"${provider.code}" is not configured (missing required ` +
          'credentials).',
      );
    }
    // The frontend's Stripe Elements checkout can never function without
    // a publishable key (`GET /payments/config` exposes it) — a backend
    // that's otherwise fully configured (real secret key) but missing
    // this would boot "successfully" into a marketplace where checkout
    // is silently broken for every customer. Local never needs one (no
    // client-side confirmation step exists), so this only applies to a
    // provider that actually uses Stripe Elements.
    if (
      config.payments.enabled &&
      provider.code === 'stripe' &&
      !config.payments.stripe.publishableKey
    ) {
      throw new Error(
        'PaymentProviderRegistry refused to start: NODE_ENV=production and ' +
          'PAYMENTS_ENABLED=true with Stripe selected, but ' +
          'STRIPE_PUBLISHABLE_KEY is not set — the frontend checkout UI ' +
          'cannot function without it.',
      );
    }
  }

  getProvider(code) {
    const provider = this.#providersByCode.get(code);
    if (!provider) {
      throw new ExternalServiceError(`Unknown payment provider "${code}".`);
    }
    return provider;
  }

  getDefaultProvider() {
    return this.getProvider(this.#defaultProviderCode);
  }
}

export default PaymentProviderRegistry;
