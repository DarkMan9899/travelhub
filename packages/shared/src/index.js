/**
 * @travelhub/shared — public entry point.
 *
 * INTENTIONALLY MINIMAL IN SPRINT 1.
 *
 * This package is reserved for pure, side-effect-free logic that is
 * genuinely identical on both the client and the server — e.g. a shared
 * currency-formatting helper, a shared date-range-overlap check used by
 * both the frontend's optimistic UI hints and the backend's own
 * authoritative validation (never as a substitute for the backend's
 * authoritative check — BOOKING_ENGINE_ARCHITECTURE.md §11.1's Layer 1
 * vs. Layer 2/3 distinction still applies; this package can back a fast
 * Layer 1 client check and a Layer 2 server check sharing one
 * implementation, but Layer 3's live, transactional check always stays
 * server-only in apps/api).
 *
 * No business rule, constant, or lookup value is added here until the
 * sprint that implements the module owning that rule — Sprint 1 does not
 * define any business logic, per this sprint's explicit scope.
 */
module.exports = {};
