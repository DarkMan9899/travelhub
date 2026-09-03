/**
 * Payments module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). Every route except `/config` and the provider webhook
 * requires authentication — a real payment provider cannot authenticate
 * as an app user, so its webhook is necessarily public, protected instead
 * by `PaymentProvider#verifyWebhook`'s signature check inside the Service
 * (never trusted on the strength of "it hit this URL" alone); `/config`
 * is public because the checkout page needs to know whether payments are
 * enabled before a customer has necessarily logged in.
 *
 * No explicit per-route rate limiter here — `app.js`'s global baseline
 * middleware already applies `authenticatedRateLimiter`/`publicRateLimiter`
 * to every request based on whether `req.principal` is resolved, exactly
 * like every other non-auth module (`bookings`, `listings`, `messaging`,
 * ...) in this codebase. `sensitiveRateLimiter` is reserved for genuinely
 * abuse-prone, unauthenticated-attempt-driven endpoints (login/register/
 * refresh, the only other module that applies it explicitly) — payment
 * creation and refunds are ordinary authenticated writes, comparable to
 * booking creation, not a brute-force target; layering a second explicit
 * limiter on top of the same request would also double-count against the
 * shared per-IP bucket, an unintentional bug rather than a real tightening.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  createPaymentSchema,
  paymentIdParamsSchema,
  listPaymentsQuerySchema,
  createRefundSchema,
  partnerBalanceParamsSchema,
  listLedgerQuerySchema,
  providerWebhookParamsSchema,
} from './validators/paymentValidators.js';

export default function createPaymentRoutes({
  paymentController,
  ledgerController,
  guards,
}) {
  const router = Router();
  const { requireAuth } = guards;

  // Public, unauthenticated — see `paymentController.getConfig`'s own
  // comment. Must be reachable before login (the checkout page needs it
  // to decide whether to render at all).
  router.get('/config', paymentController.getConfig);

  router.post(
    '/',
    requireAuth,
    validate(createPaymentSchema),
    paymentController.create,
  );

  router.get(
    '/',
    requireAuth,
    validate(listPaymentsQuerySchema),
    paymentController.list,
  );

  router.get(
    '/ledger',
    requireAuth,
    validate(listLedgerQuerySchema),
    ledgerController.listEntries,
  );

  router.get(
    '/partners/:partnerId/balance',
    requireAuth,
    validate(partnerBalanceParamsSchema),
    ledgerController.getPartnerBalance,
  );

  router.get(
    '/:id',
    requireAuth,
    validate(paymentIdParamsSchema),
    paymentController.get,
  );

  router.get(
    '/:id/refunds',
    requireAuth,
    validate(paymentIdParamsSchema),
    paymentController.listRefunds,
  );

  router.post(
    '/:id/refunds',
    requireAuth,
    validate(createRefundSchema),
    paymentController.createRefund,
  );

  // Public, unauthenticated (see header comment) — signature-verified
  // inside `PaymentService#handleProviderWebhook`, never trusted by URL
  // alone. `LocalPaymentProvider` never calls this over HTTP (its
  // simulated settlement calls the same Service method in-process); this
  // route exists for a real future provider (Phase 16 spec §13). Covered
  // by the same global `publicRateLimiter` baseline every unauthenticated
  // route gets.
  router.post(
    '/webhooks/:providerCode',
    validate(providerWebhookParamsSchema),
    paymentController.webhook,
  );

  return router;
}
