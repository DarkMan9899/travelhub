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
 *
 * P0.1 (Master Roadmap) hardening: `#request` now has a real timeout
 * (mirrors `icalConnector.js`'s `FETCH_TIMEOUT_MS`/`AbortController`
 * pattern) and bounded retry with backoff (mirrors `aiService.js`'s
 * `2 ** attempt * 200ms` precedent) — but ONLY for network failures and
 * 5xx responses, never for a 4xx (a declined card, bad request) — those
 * are real, final outcomes, not transient. Retrying a POST safely
 * requires Stripe's own `Idempotency-Key` header (without it, a retried
 * `createPaymentIntent` whose first attempt actually succeeded server-
 * side but whose response was lost could create a SECOND real
 * PaymentIntent) — `createPaymentIntent`/`refundPayment` key theirs off
 * this app's own `paymentReference`/`refundReference`, already unique
 * and stable per payment/refund, so no new identifier is invented.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { PaymentProvider } from './PaymentProvider.js';
import { ExternalServiceError } from '../../../errors/AppError.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('payments:provider:stripe');
const API_BASE = 'https://api.stripe.com/v1';
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

  #headers(idempotencyKey) {
    return {
      Authorization: `Bearer ${this.#secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': this.#apiVersion,
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {object} [body]
   * @param {string} [idempotencyKey] — required for any request that
   *   creates a new financial resource (a PaymentIntent, a Refund); safe
   *   to omit for GET/cancel/capture, which act on an already-known id.
   */
  async #request(method, path, body, idempotencyKey) {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition -- bounded by the explicit return/throw inside
    while (true) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response;
      try {
        try {
          // eslint-disable-next-line no-await-in-loop -- retry loop, sequential by design
          response = await this.#fetchImpl(`${API_BASE}${path}`, {
            method,
            headers: this.#headers(idempotencyKey),
            body: body ? toFormBody(body) : undefined,
            signal: controller.signal,
          });
        } catch (err) {
          if (attempt < MAX_RETRIES) {
            log.warn(
              { err, path, attempt },
              'Stripe request failed (network) — retrying',
            );
            // eslint-disable-next-line no-await-in-loop -- retry loop, sequential by design
            await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
            attempt += 1;
            // eslint-disable-next-line no-continue -- retry the outer while loop
            continue;
          }
          log.error({ err, path }, 'Stripe request failed');
          throw new ExternalServiceError('Failed to reach the Stripe API.');
        }
      } finally {
        clearTimeout(timeout);
      }

      // eslint-disable-next-line no-await-in-loop -- retry loop, sequential by design
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        // Only a 5xx (Stripe's own infrastructure) is treated as
        // transient — a 4xx (declined card, bad request, already-used
        // idempotency key with different params) is a real, final
        // outcome and retrying it would be pointless at best, and at
        // worst could mask a genuine error behind extra latency.
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          log.warn(
            { status: response.status, path, attempt },
            'Stripe returned a 5xx — retrying',
          );
          // eslint-disable-next-line no-await-in-loop -- retry loop, sequential by design
          await sleep(RETRY_BASE_DELAY_MS * 2 ** attempt);
          attempt += 1;
          // eslint-disable-next-line no-continue -- retry the outer while loop
          continue;
        }
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
  }

  async createPaymentIntent({
    amount,
    currencyCode,
    paymentReference,
    bookingId,
  }) {
    this.#assertConfigured();
    const payload = await this.#request(
      'POST',
      '/payment_intents',
      {
        amount: toMinorUnitsString(amount),
        currency: currencyCode.toLowerCase(),
        'metadata[payment_reference]': paymentReference,
        'metadata[booking_id]': bookingId,
      },
      // This app's own paymentReference is already unique/stable per
      // payment — retrying a lost-response create is then guaranteed to
      // land on the SAME PaymentIntent Stripe-side, never a duplicate.
      `create-intent:${paymentReference}`,
    );
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

  async refundPayment(providerPaymentId, { amount, reason, refundReference }) {
    this.#assertConfigured();
    const payload = await this.#request(
      'POST',
      '/refunds',
      {
        payment_intent: providerPaymentId,
        amount: toMinorUnitsString(amount),
        ...(reason ? { 'metadata[reason]': reason } : {}),
      },
      refundReference ? `create-refund:${refundReference}` : undefined,
    );
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
    // A failed attempt does NOT give the PaymentIntent a distinct
    // terminal "failed" status on Stripe's side — it typically reverts
    // to `requires_payment_method` (retryable), which STATUS_MAP would
    // otherwise silently normalize back to this app's `CREATED` and lose
    // the failure entirely. `payment_intent.payment_failed` is the
    // actual, authoritative signal Stripe sends for this case; the real
    // reason lives on `last_payment_error`, not on `status`.
    const isFailedAttempt = rawEvent.type === 'payment_intent.payment_failed';
    return {
      providerEventId: rawEvent.id,
      eventType: rawEvent.type,
      normalizedEventType: rawEvent.type,
      providerPaymentId: object.id ?? object.payment_intent ?? null,
      status: isFailedAttempt ? 'FAILED' : (STATUS_MAP[object.status] ?? null),
      failureCode: isFailedAttempt
        ? (object.last_payment_error?.code ?? null)
        : undefined,
      failureMessage: isFailedAttempt
        ? (object.last_payment_error?.message ?? null)
        : undefined,
    };
  }
}

export default StripePaymentProvider;
