# Module: payments

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules.

**Phase 16 status:** real implementation, built against the backend's
`apps/api/src/modules/payments/` module. Covers the customer "Pay Now"
flow and payment history, a partner payable-balance widget, and the
components admin's payment-management pages reuse (`PaymentStatusBadge`,
`PaymentSummaryCard`).

Every payment in this environment is simulated (`LocalPaymentProvider`,
the only enabled provider without external credentials) — see
`SimulatedPaymentNotice` for the UI's honest disclosure of that.

## Folder contents (per FRONTEND_ARCHITECTURE.md §3.2 / §6.2)

- `components/` — module-owned UI, composing `@travelhub/ui` primitives
- `queries/` — React Query query definitions (Ch. 14)
- `mutations/` — React Query mutation definitions (Ch. 14)
- `constants/` — the `paymentKeys` query-key factory
- `index.js` — this module's public export surface (Ch. 6.2) — the ONLY
  entry point other modules may import from (Ch. 6.3's cross-module rule)
