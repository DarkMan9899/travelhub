/**
 * LocalPaymentProvider — the only enabled provider until real credentials
 * exist (Phase 16 spec §5/§6). Real, deterministic, and NEVER moves real
 * money: every outcome is a local simulation, chosen explicitly via
 * `request.metadata.simulateScenario` (defaults to `'SUCCESS'` so normal
 * automated flows — demo, tests, a customer who never touches the
 * simulation control — just work).
 *
 * Supported scenarios (Phase 16 spec §5's exact list): `SUCCESS`,
 * `DECLINE`, `PROCESSING` (resolves asynchronously — see
 * `PaymentService#finalizeProcessingPayment`, scheduled by
 * `jobs/localProviderSettlementQueue.js`), `REQUIRES_ACTION`. Refunds are
 * always simulated as succeeding immediately (nothing in this codebase's
 * scope needs a simulated refund failure — Admin-initiated refunds are
 * already gated by RBAC and amount validation before this is ever called).
 *
 * `isConfigured` is always `true` — no external credentials are ever
 * needed to run this provider, which is exactly why it is the safe
 * default for development/demo/CI.
 */

import { v4 as uuidv4 } from 'uuid';
import { PaymentProvider } from './PaymentProvider.js';

const VALID_SCENARIOS = Object.freeze([
  'SUCCESS',
  'DECLINE',
  'PROCESSING',
  'REQUIRES_ACTION',
]);

export class LocalPaymentProvider extends PaymentProvider {
  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'local';
  }

  // eslint-disable-next-line class-methods-use-this
  get isConfigured() {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  async createPaymentIntent({ amount, currencyCode, metadata = {} }) {
    const scenario = VALID_SCENARIOS.includes(metadata.simulateScenario)
      ? metadata.simulateScenario
      : 'SUCCESS';
    const providerPaymentId = `local_pi_${uuidv4()}`;
    const raw = {
      simulated: true,
      scenario,
      amount,
      currencyCode,
      createdAt: new Date().toISOString(),
    };

    if (scenario === 'DECLINE') {
      return {
        providerPaymentId,
        status: 'FAILED',
        failureCode: 'card_declined',
        failureMessage:
          'The simulated card was declined (Development/Demo Payment — no real charge was attempted).',
        raw,
      };
    }
    if (scenario === 'PROCESSING') {
      return { providerPaymentId, status: 'PROCESSING', raw };
    }
    if (scenario === 'REQUIRES_ACTION') {
      return { providerPaymentId, status: 'REQUIRES_ACTION', raw };
    }
    return { providerPaymentId, status: 'SUCCEEDED', raw };
  }

  // eslint-disable-next-line class-methods-use-this
  async retrievePayment(providerPaymentId) {
    return {
      providerPaymentId,
      status: 'SUCCEEDED',
      raw: { simulated: true },
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async cancelPayment(providerPaymentId) {
    return {
      providerPaymentId,
      status: 'CANCELLED',
      raw: { simulated: true, cancelledAt: new Date().toISOString() },
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async capturePayment(providerPaymentId, { amount }) {
    return {
      providerPaymentId,
      status: 'SUCCEEDED',
      raw: { simulated: true, capturedAmount: amount },
    };
  }

  // eslint-disable-next-line class-methods-use-this
  async refundPayment(providerPaymentId, { amount, currencyCode, reason }) {
    return {
      providerRefundId: `local_re_${uuidv4()}`,
      status: 'SUCCEEDED',
      raw: {
        simulated: true,
        providerPaymentId,
        amount,
        currencyCode,
        reason: reason ?? null,
        refundedAt: new Date().toISOString(),
      },
    };
  }

  /** No real signature ever exists for a simulated provider — always trusted, since the only caller is this app's own in-process settlement job, never a real network boundary. */
  // eslint-disable-next-line class-methods-use-this
  async verifyWebhook() {
    return true;
  }

  // eslint-disable-next-line class-methods-use-this
  normalizeWebhookEvent(rawEvent) {
    return {
      providerEventId: rawEvent.id,
      eventType: rawEvent.type,
      normalizedEventType: rawEvent.type,
      providerPaymentId: rawEvent.providerPaymentId ?? null,
      status: rawEvent.status ?? null,
    };
  }
}

export default LocalPaymentProvider;
