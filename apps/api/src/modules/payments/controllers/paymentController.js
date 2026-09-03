/**
 * Payments module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response. No business logic, no direct database access.
 */

import config from '../../../config/index.js';
import {
  toPaymentResponse,
  toPaymentSummaryResponse,
  toRefundResponse,
  toLedgerEntryResponse,
  toPartnerBalanceResponse,
} from '../dto/paymentDto.js';

export function createPaymentController(paymentService) {
  return {
    /**
     * Public, unauthenticated (like the provider webhook route below) —
     * the frontend's payment UI reads this before rendering any "Pay
     * Now"/refund control, so a disabled marketplace never even offers
     * the action (`PaymentService#createPaymentIntent`/`#createRefund`
     * enforce the same rule server-side regardless, so this endpoint is
     * strictly a UX convenience, never the actual guard). `provider` lets
     * the frontend decide WHICH checkout UI to render (the local
     * simulate-outcome control vs. Stripe Elements) without ever loading
     * Stripe.js when it isn't the active provider. `stripe_publishable_key`
     * is the one Stripe value ever safe to expose to the browser — see
     * config/index.js's own header comment on `STRIPE_PUBLISHABLE_KEY` —
     * and is only present when Stripe is actually the active provider, so
     * the frontend never has to guess whether a present-but-irrelevant
     * key means anything.
     */
    async getConfig(req, res, next) {
      try {
        const provider = config.payments.defaultProvider;
        res.status(200).json({
          success: true,
          data: {
            enabled: config.payments.enabled,
            provider,
            ...(provider === 'stripe'
              ? {
                  stripe_publishable_key:
                    config.payments.stripe.publishableKey || null,
                }
              : {}),
          },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async create(req, res, next) {
      try {
        const { bookingId, idempotencyKey, simulateScenario } =
          req.validated.body;
        const payment = await paymentService.createPaymentIntent(
          req.principal,
          bookingId,
          { idempotencyKey, simulateScenario },
        );
        res.status(201).json({
          success: true,
          data: toPaymentResponse(payment),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async get(req, res, next) {
      try {
        const { id } = req.validated.params;
        const payment = await paymentService.getPayment(req.principal, id);
        res.status(200).json({
          success: true,
          data: toPaymentResponse(payment),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const { partnerId, bookingId, viewAll, status, cursor, limit } =
          req.validated.query;
        const { rows, meta } = await paymentService.listPayments(
          req.principal,
          { partnerId, bookingId, viewAll, status },
          { cursor, limit },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toPaymentSummaryResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async createRefund(req, res, next) {
      try {
        const { id } = req.validated.params;
        const refund = await paymentService.createRefund(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toRefundResponse(refund),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listRefunds(req, res, next) {
      try {
        const { id } = req.validated.params;
        const refunds = await paymentService.listRefundsForPayment(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: refunds.map(toRefundResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async webhook(req, res, next) {
      try {
        const { providerCode } = req.validated.params;
        await paymentService.handleProviderWebhook(providerCode, {
          rawBody: req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})),
          signatureHeader: req.get('Stripe-Signature') ?? null,
          parsedEvent: req.body,
        });
        // Webhook endpoints must always ack with 200 once the event has
        // been durably recorded (even a "duplicate"/"payment not found"
        // outcome) — a non-2xx here would make a well-behaved provider
        // retry indefinitely for a case this app has already handled.
        res
          .status(200)
          .json({ success: true, data: null, meta: null, error: null });
      } catch (err) {
        next(err);
      }
    },
  };
}

export function createLedgerController(ledgerService) {
  return {
    async listEntries(req, res, next) {
      try {
        const { partnerId, entryType, cursor, limit } = req.validated.query;
        const { rows, meta } = await ledgerService.listEntries(
          req.principal,
          { partnerId, entryType },
          { cursor, limit },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toLedgerEntryResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getPartnerBalance(req, res, next) {
      try {
        const { partnerId } = req.validated.params;
        const balances = await ledgerService.getPartnerBalance(
          req.principal,
          partnerId,
        );
        res.status(200).json({
          success: true,
          data: toPartnerBalanceResponse(balances),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createPaymentController;
