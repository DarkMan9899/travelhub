-- Payment Infrastructure foundation (Phase 16). Replaces the empty
-- `apps/api/src/modules/payments/` (and `refunds/`) scaffolds with a real,
-- provider-independent schema. Builds ON TOP OF the existing `bookings`
-- payment columns (migration 0008) rather than replacing them:
-- `bookings.payment_status_id` stays the coarse, booking-facing summary
-- (extended in seed 011 with online-payment codes); this migration adds
-- the Payment domain's own fine-grained, auditable state.
--
-- No real money ever moves here — `LocalPaymentProvider` (the only
-- enabled provider until real credentials exist) simulates every outcome.
-- The schema is written to be provider-independent from day one so a real
-- provider (e.g. Stripe) is a new adapter + config values, never a schema
-- change: `provider_code`/`provider_payment_id`/`provider_refund_id` are
-- plain columns (same "data/application change, not a schema migration"
-- precedent as `bookings.payment_method`), and no provider-specific ID
-- shape or status vocabulary leaks past the provider adapter boundary.
--
-- A booking and its payment(s) are deliberately separate domains — a
-- booking can have more than one `payments` row over time (a declined
-- attempt followed by a successful retry), but the Payment Service only
-- ever allows one *active* (non-terminal) payment per booking at a time.
-- Refunds are their own table/lifecycle, never a mutation of the original
-- payment row into "being" a refund.

CREATE TABLE IF NOT EXISTS payment_intent_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_payment_intent_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refund_statuses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT uq_refund_statuses_code UNIQUE (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The Payment / PaymentIntent entity. `base_amount`/`fees_amount`/
-- `discount_amount`/`total_amount` are a price SNAPSHOT copied from the
-- owning booking at creation time (Phase 16 spec §8) — later pricing
-- changes elsewhere can never mutate a historical payment record.
-- `tax_amount` defaults to 0.00 honestly (no tax engine exists anywhere
-- in this codebase yet); the column exists so a future tax feature is a
-- data change, not a schema migration.
CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_reference VARCHAR(30) NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  customer_user_id BIGINT UNSIGNED NOT NULL,
  partner_id BIGINT UNSIGNED NOT NULL,
  provider_code VARCHAR(30) NOT NULL DEFAULT 'local',
  provider_payment_id VARCHAR(255) NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  base_amount DECIMAL(12,2) NOT NULL,
  fees_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total_amount DECIMAL(12,2) NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  -- Running rollups, updated only by PaymentService/RefundService inside a
  -- transaction alongside the corresponding payment_transactions row —
  -- never recomputed ad hoc, so a query never needs to SUM history.
  captured_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  refunded_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  idempotency_key VARCHAR(255) NULL,
  failure_code VARCHAR(50) NULL,
  failure_message VARCHAR(500) NULL,
  -- Never contains card numbers/CVV/banking credentials — provider
  -- adapters only ever pass through opaque references and simulation
  -- metadata (e.g. which demo scenario was selected).
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  authorized_at DATETIME(3) NULL,
  succeeded_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  created_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_payments_payment_reference UNIQUE (payment_reference),
  CONSTRAINT uq_payments_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT fk_payments_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_payments_customer_user_id FOREIGN KEY (customer_user_id) REFERENCES users (id),
  CONSTRAINT fk_payments_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_payments_status_id FOREIGN KEY (status_id) REFERENCES payment_intent_statuses (id),
  CONSTRAINT fk_payments_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users (id),
  KEY idx_payments_booking_id_status_id (booking_id, status_id),
  KEY idx_payments_customer_user_id_created_at (customer_user_id, created_at),
  KEY idx_payments_partner_id_status_id_created_at (partner_id, status_id, created_at),
  KEY idx_payments_status_id_created_at (status_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Its own lifecycle, entirely separate from the payment it refunds
-- (Phase 16 spec §11) — the original `payments` row is only ever updated
-- via its derived `refunded_amount` rollup once a refund SUCCEEDs.
CREATE TABLE IF NOT EXISTS refunds (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  refund_reference VARCHAR(30) NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(255) NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  provider_code VARCHAR(30) NOT NULL,
  provider_refund_id VARCHAR(255) NULL,
  idempotency_key VARCHAR(255) NULL,
  failure_code VARCHAR(50) NULL,
  failure_message VARCHAR(500) NULL,
  requested_by BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  succeeded_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_refunds_refund_reference UNIQUE (refund_reference),
  CONSTRAINT uq_refunds_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT fk_refunds_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id),
  CONSTRAINT fk_refunds_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT fk_refunds_status_id FOREIGN KEY (status_id) REFERENCES refund_statuses (id),
  CONSTRAINT fk_refunds_requested_by FOREIGN KEY (requested_by) REFERENCES users (id),
  KEY idx_refunds_payment_id_status_id (payment_id, status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per provider call attempt within a payment's lifecycle (a
-- decline followed by a retry is two rows on the same `payment_id`,
-- distinguished by `attempt_number`) — satisfies "PaymentAttempt" as its
-- own concept (Phase 16 spec §1), never conflated with the payment itself.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id BIGINT UNSIGNED NOT NULL,
  attempt_number INT UNSIGNED NOT NULL DEFAULT 1,
  provider_code VARCHAR(30) NOT NULL,
  provider_request_id VARCHAR(255) NULL,
  status_id BIGINT UNSIGNED NOT NULL,
  failure_code VARCHAR(50) NULL,
  failure_message VARCHAR(500) NULL,
  -- Sanitized provider response only — never card data, since none is
  -- ever collected by this application in the first place.
  raw_provider_response JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_payment_attempts_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id),
  CONSTRAINT fk_payment_attempts_status_id FOREIGN KEY (status_id) REFERENCES payment_intent_statuses (id),
  KEY idx_payment_attempts_payment_id_created_at (payment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Append-only financial audit trail — mirrors `booking_status_history`'s
-- exact "written in the same transaction as the state change itself"
-- pattern (Phase 16 spec §10). Never updated or deleted once written;
-- this is what lets Admin/Support reconstruct what happened to a payment.
CREATE TABLE IF NOT EXISTS payment_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_id BIGINT UNSIGNED NOT NULL,
  refund_id BIGINT UNSIGNED NULL,
  type VARCHAR(40) NOT NULL,
  amount DECIMAL(12,2) NULL,
  currency_id BIGINT UNSIGNED NULL,
  actor_id BIGINT UNSIGNED NULL,
  metadata JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_payment_transactions_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id),
  CONSTRAINT fk_payment_transactions_refund_id FOREIGN KEY (refund_id) REFERENCES refunds (id),
  CONSTRAINT fk_payment_transactions_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  CONSTRAINT fk_payment_transactions_actor_id FOREIGN KEY (actor_id) REFERENCES users (id),
  KEY idx_payment_transactions_payment_id_created_at (payment_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Webhook/provider-event infrastructure, ready for a real async provider
-- even though `LocalPaymentProvider` delivers its own simulated events
-- in-process today (Phase 16 spec §13). `UNIQUE(provider_code,
-- provider_event_id)` is the idempotency guarantee for duplicate
-- delivery — a redelivered event is a safe no-op, never a duplicate
-- financial operation. Client-side callbacks are never trusted as
-- payment truth; only a processed provider event (or the synchronous
-- provider response for `LocalPaymentProvider`) is.
CREATE TABLE IF NOT EXISTS payment_provider_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider_code VARCHAR(30) NOT NULL,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  normalized_event_type VARCHAR(100) NULL,
  payload JSON NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  processing_error VARCHAR(500) NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_payment_provider_events UNIQUE (provider_code, provider_event_id),
  CONSTRAINT fk_payment_provider_events_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id),
  KEY idx_payment_provider_events_processing_status_received_at (processing_status, received_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Platform financial accounting, append-only (Phase 16 spec §10/§12).
-- Deliberately holds no "balance" column anywhere — a partner's payable
-- balance is always computed on read (SUM of relevant entry_types for
-- that partner_id), the same way this codebase never caches a derived
-- aggregate that could silently drift from its source rows. This is the
-- minimal foundation for future payouts (§12) without building any
-- actual payout processing.
CREATE TABLE IF NOT EXISTS financial_ledger_entries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entry_type VARCHAR(40) NOT NULL,
  payment_id BIGINT UNSIGNED NULL,
  refund_id BIGINT UNSIGNED NULL,
  booking_id BIGINT UNSIGNED NULL,
  partner_id BIGINT UNSIGNED NULL,
  -- Signed: positive credits the referenced party, negative debits it.
  amount DECIMAL(12,2) NOT NULL,
  currency_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_financial_ledger_entries_payment_id FOREIGN KEY (payment_id) REFERENCES payments (id),
  CONSTRAINT fk_financial_ledger_entries_refund_id FOREIGN KEY (refund_id) REFERENCES refunds (id),
  CONSTRAINT fk_financial_ledger_entries_booking_id FOREIGN KEY (booking_id) REFERENCES bookings (id),
  CONSTRAINT fk_financial_ledger_entries_partner_id FOREIGN KEY (partner_id) REFERENCES partners (id),
  CONSTRAINT fk_financial_ledger_entries_currency_id FOREIGN KEY (currency_id) REFERENCES currencies (id),
  KEY idx_financial_ledger_entries_partner_id_created_at (partner_id, created_at),
  KEY idx_financial_ledger_entries_payment_id (payment_id),
  KEY idx_financial_ledger_entries_entry_type_created_at (entry_type, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
