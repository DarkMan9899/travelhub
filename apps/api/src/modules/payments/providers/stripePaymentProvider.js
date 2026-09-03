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
    metadata = {},
  }) {
    this.#assertConfigured();
    // Stripe go-live preflight fix: the caller's own `metadata` object
    // was previously silently dropped; every entry is now forwarded as
    // its own `metadata[<key>]` form field, same convention as the two
    // hardcoded keys below. `simulateScenario` — meaningful only to
    // `LocalPaymentProvider` — never appears here at all:
    // `PaymentService#createPaymentIntent` only ever includes it in the
    // metadata object it builds when the active provider IS `local`
    // (release-architecture requirement: no demo/simulation control may
    // reach a real provider's request, not even as an inert tag).
    const metadataFields = Object.fromEntries(
      Object.entries(metadata)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [`metadata[${key}]`, value]),
    );
    const payload = await this.#request(
      'POST',
      '/payment_intents',
      {
        amount: toMinorUnitsString(amount),
        currency: currencyCode.toLowerCase(),
        // Manual-capture booking payment flow: the customer's card is
        // authorized at checkout, never captured until the vendor accepts
        // the booking (`BookingService#confirmBooking` ->
        // `PaymentService#capturePaymentForBookingSystemInternal` ->
        // `capturePayment` below). A successful authorization resolves to
        // Stripe's `requires_capture` status, mapped to this app's
        // `AUTHORIZED` (STATUS_MAP above) — never straight to `SUCCEEDED`.
        capture_method: 'manual',
        // Lets Stripe Elements' Payment Element offer every payment method
        // enabled on the Dashboard that's actually compatible with manual
        // capture (Stripe silently filters out any that aren't) — never a
        // single hardcoded `payment_method_types: ['card']`, which would
        // require a code change every time the business enables a new
        // method.
        'automatic_payment_methods[enabled]': 'true',
        ...metadataFields,
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
      // The one value the frontend's `stripe.confirmPayment` call needs —
      // safe to return to the browser (Stripe's own design: a client
      // secret can only confirm/cancel THIS one PaymentIntent, never read
      // or act on anything else). Never persisted — see paymentDto.js's
      // header comment on why this is a request-time-only field.
      clientSecret: payload.client_secret ?? null,
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
      // Re-fetched fresh each call — lets a page reload mid-checkout
      // resume the same PaymentIntent (`PaymentService#getPayment`) rather
      // than dead-ending on a payment `findActiveForBooking` still
      // correctly refuses to let a second one be created against.
      clientSecret: payload.client_secret ?? null,
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

  /**
   * Stripe go-live preflight fix: `data.object` is a DIFFERENT object
   * shape depending on the event family — a PaymentIntent for
   * `payment_intent.*` events, but a Refund (or a Charge, for
   * `charge.refunded`) for refund-family events. Every Stripe object has
   * its own `.id` (the previous `object.id ?? object.payment_intent`
   * fallback could never actually trigger, and silently resolved refund/
   * charge events to the WRONG id — a Refund's own id, misread as if it
   * were the PaymentIntent id). Returns a `kind`-discriminated shape so
   * `PaymentService#handleProviderWebhook` can route each family to the
   * correct table (`payments` vs `refunds`) with the correct id and
   * status vocabulary, rather than treating every event as a payment
   * status change.
   */
  // eslint-disable-next-line class-methods-use-this
  normalizeWebhookEvent(rawEvent) {
    const object = rawEvent.data?.object ?? {};
    const eventType = rawEvent.type;

    if (eventType.startsWith('refund.') || eventType === 'charge.refunded') {
      return {
        kind: 'refund',
        providerEventId: rawEvent.id,
        eventType,
        normalizedEventType: eventType,
        providerRefundId: object.id ?? null,
        providerPaymentId: object.payment_intent ?? null,
        status: REFUND_STATUS_MAP[object.status] ?? null,
      };
    }

    if (eventType.startsWith('payment_intent.')) {
      // A failed attempt does NOT give the PaymentIntent a distinct
      // terminal "failed" status on Stripe's side — it typically reverts
      // to `requires_payment_method` (retryable), which STATUS_MAP would
      // otherwise silently normalize back to this app's `CREATED` and
      // lose the failure entirely. `payment_intent.payment_failed` is
      // the actual, authoritative signal Stripe sends for this case; the
      // real reason lives on `last_payment_error`, not on `status`.
      const isFailedAttempt = eventType === 'payment_intent.payment_failed';
      return {
        kind: 'payment',
        providerEventId: rawEvent.id,
        eventType,
        normalizedEventType: eventType,
        providerPaymentId: object.id ?? null,
        status: isFailedAttempt
          ? 'FAILED'
          : (STATUS_MAP[object.status] ?? null),
        failureCode: isFailedAttempt
          ? (object.last_payment_error?.code ?? null)
          : undefined,
        failureMessage: isFailedAttempt
          ? (object.last_payment_error?.message ?? null)
          : undefined,
      };
    }

    // Any other Stripe event type this app doesn't act on yet
    // (customer.*, charge.dispute.*, ...) — normalized but deliberately
    // inert; `handleProviderWebhook` acks it without touching financial
    // state, rather than misrouting it as a payment/refund status change.
    return {
      kind: 'unhandled',
      providerEventId: rawEvent.id,
      eventType,
      normalizedEventType: eventType,
      providerPaymentId: null,
      providerRefundId: null,
      status: null,
    };
  }
}

export default StripePaymentProvider;
