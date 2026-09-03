/**
 * Payments module — raw endpoint calls (FRONTEND_ARCHITECTURE.md §3.1's
 * `api/` contract). Mirrors `apps/api/src/modules/payments/module.routes.js`
 * 1:1. Every route requires authentication except the provider webhook,
 * which this app never calls directly (it's a server-to-server endpoint).
 */

import apiClient from './client.js';

/**
 * `GET /payments/config` — public, unauthenticated. `{ enabled: boolean }`
 * tells the checkout UI whether online payments are switched on at all
 * (go-live sequencing: the marketplace can launch before real payments
 * are enabled) — the backend enforces this independently either way
 * (`PAYMENTS_DISABLED`, 503), so this is purely a UX gate, never the
 * actual guard.
 */
export function getPaymentsConfig() {
  return apiClient.get('/payments/config').then((response) => response.data);
}

/**
 * `POST /payments` — `{ bookingId, idempotencyKey?, simulateScenario? }`.
 * `simulateScenario` only has any effect against the `local` provider
 * (the only one enabled without external credentials) — a real provider
 * ignores it. Payment truth always comes back from this response, never
 * assumed client-side.
 */
export function createPayment(payload) {
  return apiClient.post('/payments', payload).then((response) => response.data);
}

/** `GET /payments/:id` — 404-masked to the payment's own customer, the booking's partner, or `payment.view`. */
export function getPayment(id) {
  return apiClient.get(`/payments/${id}`).then((response) => response.data);
}

/**
 * `GET /payments` — defaults to the caller's own payments. Accepts
 * `bookingId` (find the payment for one specific booking), `partnerId`
 * (owner/staff or `payment.view`), or `viewAll` (admin `payment.view`).
 * @param {{ bookingId?: number, partnerId?: number, viewAll?: boolean, status?: string, cursor?: string, limit?: number }} params
 */
export function listPayments(params) {
  return apiClient
    .get('/payments', { params })
    .then((response) => response.data);
}

/** `GET /payments/:id/refunds` — same 404-masked visibility as `getPayment`. */
export function listRefundsForPayment(paymentId) {
  return apiClient
    .get(`/payments/${paymentId}/refunds`)
    .then((response) => response.data);
}

/**
 * `POST /payments/:id/refunds` — `{ amount, reason?, idempotencyKey? }`.
 * Admin-only (`payment.refund`) — never exposed to a customer or partner
 * in the UI.
 */
export function createRefund(paymentId, payload) {
  return apiClient
    .post(`/payments/${paymentId}/refunds`, payload)
    .then((response) => response.data);
}

/** `GET /payments/partners/:partnerId/balance` — owner/staff of that partner, or `payment.view`. */
export function getPartnerBalance(partnerId) {
  return apiClient
    .get(`/payments/partners/${partnerId}/balance`)
    .then((response) => response.data);
}

/** `GET /payments/ledger` — Admin/Support (`payment.view`) only. */
export function listLedgerEntries(params) {
  return apiClient
    .get('/payments/ledger', { params })
    .then((response) => response.data);
}
