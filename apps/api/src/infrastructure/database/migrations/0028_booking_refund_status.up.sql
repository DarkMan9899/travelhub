-- P0.2 (Master Roadmap): booking <-> payment <-> refund lifecycle.
-- `cancelBooking` previously never touched the Payments module at all —
-- a CONFIRMED booking with a SUCCEEDED payment could be cancelled and
-- the payment simply stayed SUCCEEDED, with no visible signal that a
-- refund might be owed. This column is that signal: a small, closed,
-- code-owned vocabulary (NOT_APPLICABLE/AUTO_REFUNDED/
-- REQUIRES_MANUAL_REVIEW/REFUND_FAILED), plain VARCHAR rather than a
-- lookup table — mirrors migration 0025's own stated precedent
-- ("a value with no admin-facing CRUD need and a small, code-owned
-- vocabulary doesn't need a table").

ALTER TABLE bookings ADD COLUMN refund_status VARCHAR(30) NOT NULL DEFAULT 'NOT_APPLICABLE' AFTER cancellation_reason;
