# Module: admin

**Domain group:** Platform
**Specification:** see `BACKEND_ARCHITECTURE.md` Part XI (Module Catalog) for
this module's Purpose, Responsibilities, Public/Internal Services,
Dependencies, Database Tables, Events, Queue Jobs, Transactions, Caching
Rules, Error Strategy, and Validation Strategy.
**Endpoint contract:** see `API_SPECIFICATION.md` for this module's exact
request/response shapes.

**Phase 11 status:** `GET /admin/dashboard` implemented (marketplace
metrics composed from existing users/partners/listings/bookings/
audit_logs tables — no new tables needed). Every route in this module
requires one of the four admin-area roles (ADMIN/SUPER_ADMIN/MODERATOR/
SUPPORT) via `requireRole`. Later Phase 11 stages add audit-log reads,
system health, and settings/feature-flags here — per-entity admin
actions (suspend a user, verify a partner, moderate a listing) live in
their own existing modules instead, never duplicated here.

## Folder contents (per BACKEND_ARCHITECTURE.md §2)

- `controllers/` — HTTP-to-Service translation only (Ch. 5)
- `services/` — Application-layer use cases (Ch. 6)
- `repositories/` — database access, implementing Domain-layer ports (Ch. 7)
- `models/` — domain entities (Ch. 8)
- `dto/` — request/response shapes (Ch. 9)
- `validators/` — Layer 2 structural validation (Ch. 10)
- `events/` — domain events this module publishes
- `jobs/` — BullMQ job definitions this module owns (Ch. 36)
