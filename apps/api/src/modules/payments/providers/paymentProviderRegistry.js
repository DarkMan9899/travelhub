/**
 * Payment Provider Registry (Phase 16).
 *
 * Constructed once in `module.container.js` from `config.payments` —
 * mirrors `modules/ai/providers/providerRegistry.js`'s exact shape.
 * `PaymentService` is the only consumer; it never `new`s a provider
 * directly. Selecting an unregistered code, or a provider missing its
 * required configuration (e.g. Stripe with no secret key), both surface
 * as a clear `ExternalServiceError` at call time — never a boot-time
 * crash (matches this codebase's envalid-all-defaults convention).
 */

import { ExternalServiceError } from '../../../errors/AppError.js';
import { LocalPaymentProvider } from './localPaymentProvider.js';
import { StripePaymentProvider } from './stripePaymentProvider.js';

export class PaymentProviderRegistry {
  #providersByCode = new Map();

  #defaultProviderCode;

  constructor({ paymentsConfig }) {
    this.#defaultProviderCode = paymentsConfig.defaultProvider;
    this.#register(new LocalPaymentProvider());
    this.#register(new StripePaymentProvider(paymentsConfig.stripe));
  }

  #register(provider) {
    this.#providersByCode.set(provider.code, provider);
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
