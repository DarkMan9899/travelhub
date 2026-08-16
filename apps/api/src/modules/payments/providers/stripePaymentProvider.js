/**
 * StripePaymentProvider — real `PaymentProvider` adapter against Stripe's
 * REST API. Architecture-ready per Phase 16 spec §6: selected via
 * `PAYMENT_DEFAULT_PROVIDER=stripe` + `STRIPE_SECRET_KEY` (see
 * config/index.js), but never live-called in this environment (no real
 * key is configured anywhere in this repo). Only unit-tested with mocked
 * `fetch` responses — mirrors `modules/ai/providers/openAiProvider.js`'s
 * exact "real adapter, never live-called, fails clearly at call time if
 * unconfigured" precedent.
 *
 * Every Stripe-specific field name/status string (`payment_intents`,
 * `requires_capture`, `data.object`, ...) is translated to this app's own
 * normalized vocabulary inside this file and never leaks past it —
 * `PaymentService` only ever sees the shape `PaymentProvider` declares.
 *
 * Webhook signature verification is REAL, not a stub — Stripe's documented
 * scheme (`Stripe-Signature: t=<timestamp>,v1=<hex hmac>`, HMAC-SHA256 of
 * `${timestamp}.${rawBody}` keyed by the webhook secret, constant-time
 * compared) is implemented with Node's built-in `crypto`, so a future real
 * webhook is verified correctly on day one. Per Phase 16 spec §6, this is
 * never exercised against a real live event in this environment — only
 * unit-tested against a self-signed fixture.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProvider } from './PaymentProvider.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('payments:provider:stripe');
const API_BASE = 'https://api.stripe.com/v1';

// Stripe's own PaymentIntent status vocabulary -> this app's normalized codes.
const STATUS_MAP = Object.freeze({
  requires_payment_method: 'CREATED',
  requires_confirmation: 'CREATED',
  requires_action: 'REQUIRES_ACTION',
  processing: 'PROCESSING',
  requires_capture: 'AUTHORIZED',
  succeeded: 'SUCCEEDED',
  canceled: 'CANCELLED',
});

// Stripe's own Refund status vocabulary -> this app's normalized codes.
const REFUND_STATUS_MAP = Object.freeze({
  succeeded: 'SUCCEEDED',
  failed: 'FAILED',
  pending: 'PROCESSING',
  requires_action: 'PROCESSING',
  canceled: 'FAILED',
});

function toMinorUnitsString(decimalAmount) {
  // Stripe's Payment Intents API takes an integer minor-units amount, not
  // a decimal string — this app's own DECIMAL(12,2) columns always have
  // exactly 2 fraction digits (Money's own convention), so this is a safe,
  // lossless string transform, never a float multiplication.
  return decimalAmount.replace('.', '').replace(/^0+(?=\d)/, '');
}

function toFormBody(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    search.append(key, String(value));
  });
  return search.toString();
}

export class StripePaymentProvider extends PaymentProvider {
  #secretKey;

  #webhookSecret;

  #apiVersion;

  #fetchImpl;

  constructor({
    secretKey,
    webhookSecret,
    apiVersion,
    fetchImpl = fetch,
  } = {}) {
    super();
    this.#secretKey = secretKey;
    this.#webhookSecret = webhookSecret;
    this.#apiVersion = apiVersion;
    this.#fetchImpl = fetchImpl;
  }

  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'stripe';
  }

  get isConfigured() {
    return Boolean(this.#secretKey);
  }

  #assertConfigured() {
    if (!this.isConfigured) {
      throw new ExternalServiceError(
        'The Stripe provider is selected but STRIPE_SECRET_KEY is not configured.',
      );
    }
  }

  #headers() {
    return {
      Authorization: `Bearer ${this.#secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.#apiVersion,
    };
  }

  async #request(method, path, body) {
    let response;
    try {
      response = await this.#fetchImpl(`${API_BASE}${path}`, {
        method,
        headers: this.#headers(),
        body: body ? toFormBody(body) : undefined,
      });
    } catch (err) {
      log.error({ err, path }, 'Stripe request failed');
      throw new ExternalServiceError('Failed to reach the Stripe API.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      log.error(
        { status: response.status, path },
        'Stripe returned a non-OK status',
      );
      throw new ExternalServiceError(
        payload?.error?.message ?? 'The Stripe API returned an error.',
      );
    }
    return payload;
  }

  async createPaymentIntent({
    amount,
    currencyCode,
    paymentReference,
    bookingId,
  }) {
    this.#assertConfigured();
    const payload = await this.#request('POST', '/payment_intents', {
      amount: toMinorUnitsString(amount),
      currency: currencyCode.toLowerCase(),
      'metadata[payment_reference]': paymentReference,
      'metadata[booking_id]': bookingId,
    });
    return {
      providerPaymentId: payload.id,
      status: STATUS_MAP[payload.status] ?? 'CREATED',
      raw: payload,
    };
  }

  async retrievePayment(providerPaymentId) {
    this.#assertConfigured();
    const payload = await this.#request(
      'GET',
      `/payment_intents/${providerPaymentId}`,
    );
    return {
      providerPaymentId: payload.id,
      status: STATUS_MAP[payload.status] ?? 'CREATED',
      raw: payload,
    };
  }

  async cancelPayment(providerPaymentId) {
    this.#assertConfigured();
    const payload = await this.#request(
      'POST',
      `/payment_intents/${providerPaymentId}/cancel`,
    );
    return {
      providerPaymentId: payload.id,
      status: STATUS_MAP[payload.status] ?? 'CANCELLED',
      raw: payload,
    };
  }

  async capturePayment(providerPaymentId, { amount }) {
    this.#assertConfigured();
    const payload = await this.#request(
      'POST',
      `/payment_intents/${providerPaymentId}/capture`,
      amount ? { amount_to_capture: toMinorUnitsString(amount) } : undefined,
    );
    return {
      providerPaymentId: payload.id,
      status: STATUS_MAP[payload.status] ?? 'SUCCEEDED',
      raw: payload,
    };
  }

  async refundPayment(providerPaymentId, { amount, reason }) {
    this.#assertConfigured();
    const payload = await this.#request('POST', '/refunds', {
      payment_intent: providerPaymentId,
      amount: toMinorUnitsString(amount),
      ...(reason ? { 'metadata[reason]': reason } : {}),
    });
    return {
      providerRefundId: payload.id,
      status: REFUND_STATUS_MAP[payload.status] ?? 'PROCESSING',
      raw: payload,
    };
  }

  /** Real Stripe signature scheme — see this file's header comment. */
  async verifyWebhook({ rawBody, signatureHeader }) {
    if (!this.#webhookSecret || !signatureHeader) return false;
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((part) => part.split('=')),
    );
    const { t: timestamp, v1: signature } = parts;
    if (!timestamp || !signature) return false;

    const expected = createHmac('sha256', this.#webhookSecret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');
    if (expectedBuffer.length !== actualBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, actualBuffer);
  }

  // eslint-disable-next-line class-methods-use-this
  normalizeWebhookEvent(rawEvent) {
    const object = rawEvent.data?.object ?? {};
    return {
      providerEventId: rawEvent.id,
      eventType: rawEvent.type,
      normalizedEventType: rawEvent.type,
      providerPaymentId: object.id ?? object.payment_intent ?? null,
      status: STATUS_MAP[object.status] ?? null,
    };
  }
}

export default StripePaymentProvider;
