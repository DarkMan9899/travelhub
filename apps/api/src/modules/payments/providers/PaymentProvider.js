/**
 * PaymentProvider port (Phase 16).
 *
 * The whole point of this interface: `PaymentService` (and therefore
 * every controller/route built on it) never knows or cares which concrete
 * payment provider is behind it. Every adapter in this directory
 * (Local/Stripe, and any future one) implements this exact shape and is
 * selected by `paymentProviderRegistry.js` from
 * `config.payments.defaultProvider` — swapping providers is a one-line
 * config change, never a code change in a business service, controller,
 * or React component. Mirrors `modules/ai/providers/AIProvider.js`'s
 * established port pattern.
 *
 * Every method's return `status`/`refundStatus` is always one of this
 * app's OWN normalized vocabulary (`core/domain/paymentStatusTransitions.js`
 * / `refundStatusTransitions.js`'s status codes) — a provider-specific
 * status string (e.g. Stripe's `requires_payment_method`) is translated
 * inside the adapter and never leaks past this boundary.
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class PaymentProvider {
  /** @returns {string} a short, stable code identifying this provider (e.g. 'local', 'stripe'). */
  get code() {
    throw new Error(
      'PaymentProvider.code must be implemented by a concrete adapter.',
    );
  }

  /** @returns {boolean} whether this provider has everything it needs (e.g. an API key) to actually be called. */
  get isConfigured() {
    throw new Error(
      'PaymentProvider.isConfigured must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {{amount: string, currencyCode: string, paymentReference: string, bookingId: number, metadata?: object}} request
   * @returns {Promise<{providerPaymentId: string, status: string, failureCode?: string, failureMessage?: string, raw: object}>}
   */
  async createPaymentIntent(request) {
    throw new Error(
      'PaymentProvider.createPaymentIntent must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {string} providerPaymentId
   * @returns {Promise<{providerPaymentId: string, status: string, raw: object}>}
   */
  async retrievePayment(providerPaymentId) {
    throw new Error(
      'PaymentProvider.retrievePayment must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {string} providerPaymentId
   * @returns {Promise<{providerPaymentId: string, status: string, raw: object}>}
   */
  async cancelPayment(providerPaymentId) {
    throw new Error(
      'PaymentProvider.cancelPayment must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {string} providerPaymentId
   * @param {{amount: string}} options
   * @returns {Promise<{providerPaymentId: string, status: string, raw: object}>}
   */
  async capturePayment(providerPaymentId, options) {
    throw new Error(
      'PaymentProvider.capturePayment must be implemented by a concrete adapter.',
    );
  }

  /**
   * @param {string} providerPaymentId
   * @param {{amount: string, currencyCode: string, reason?: string}} options
   * @returns {Promise<{providerRefundId: string, status: string, failureCode?: string, failureMessage?: string, raw: object}>}
   */
  async refundPayment(providerPaymentId, options) {
    throw new Error(
      'PaymentProvider.refundPayment must be implemented by a concrete adapter.',
    );
  }

  /**
   * Signature verification belongs entirely inside the adapter — no
   * business logic ever sees a raw provider secret.
   * @param {{rawBody: string|Buffer, signatureHeader: string}} args
   * @returns {Promise<boolean>}
   */
  async verifyWebhook(args) {
    throw new Error(
      'PaymentProvider.verifyWebhook must be implemented by a concrete adapter.',
    );
  }

  /**
   * Maps a provider's raw webhook payload into this app's normalized
   * event shape — provider-specific field names/status strings never
   * leak past this method.
   * @param {object} rawEvent
   * @returns {{providerEventId: string, eventType: string, normalizedEventType: string, providerPaymentId: string|null, status: string|null}}
   */
  normalizeWebhookEvent(rawEvent) {
    throw new Error(
      'PaymentProvider.normalizeWebhookEvent must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default PaymentProvider;
