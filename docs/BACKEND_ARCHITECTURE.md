# BACKEND ARCHITECTURE

**Travel Hub Armenia — Backend Engineering Contract**
**Status:** Final · **Version:** 1.0 · **Classification:** Confidential
**Owner:** Chief Backend Architect
**Depends on (must never be contradicted):** `PROJECT_BIBLE.md` · `UI_UX_GUIDELINES.md` · `DATABASE_ARCHITECTURE.md` · `BOOKING_ENGINE_ARCHITECTURE.md` · `API_SPECIFICATION.md` · `FRONTEND_ARCHITECTURE.md`

---

> "The frontend can be rebuilt in a weekend. The backend is the business.
> Every rule in this document exists so that a system processing one
> booking a day and a system processing a million bookings a day are
> running the *same code*, under *more machines* — never a rewrite."

This document is the binding engineering contract for the Node.js/Express
backend: how it is layered, how its modules are bounded, how it talks to
MySQL, Redis, and the payment/notification providers, and how every rule
already fixed in `BOOKING_ENGINE_ARCHITECTURE.md` (state machines, holds,
locking) and `API_SPECIFICATION.md` (the contract it must serve exactly) is
actually implemented underneath. It does not redefine endpoints
(`API_SPECIFICATION.md` owns those), the schema (`DATABASE_ARCHITECTURE.md`
owns that), or booking state transitions
(`BOOKING_ENGINE_ARCHITECTURE.md` owns those) — it defines the engineering
structure that makes all three real, correct, and scalable.

No source code, SQL, or endpoint definitions appear in this document.

## Table of Contents

**Part I — Foundations**
1. Backend Philosophy · 2. Project Folder Structure · 3. Clean Architecture Layers

**Part II — Module & Layer Architecture**
4. Module Architecture · 5. Controllers · 6. Services · 7. Repositories ·
8. Models · 9. DTOs · 10. Validators · 11. Middleware

**Part III — Identity, Access, and Platform Plumbing**
12. Authentication · 13. Authorization · 14. RBAC · 15. Partner Permissions ·
16. Admin Permissions · 17. Dependency Injection Strategy ·
18. Configuration Management · 19. Environment Variables

**Part IV — Observability and Errors**
20. Logging Strategy · 21. Audit Logs · 22. Activity Logs · 23. Error Handling ·
24. Exception Hierarchy · 25. Validation Pipeline

**Part V — Engine Integrations**
26. Booking Engine Integration · 27. Availability Engine Integration ·
28. Pricing Engine Integration · 29. Payment Integration

**Part VI — Media and Communication**
30. File Upload Pipeline · 31. Image Processing Pipeline ·
32. Notification Service · 33. Email Service · 34. SMS Service

**Part VII — Async, Concurrency, and Data Integrity**
35. Queue Architecture · 36. BullMQ Jobs · 37. Scheduled Jobs ·
38. Redis Architecture · 39. Cache Strategy · 40. Database Transactions ·
41. Optimistic Locking · 42. Distributed Locking · 43. Idempotency

**Part VIII — Integration and Search**
44. Webhooks · 45. External Integrations · 46. Search Strategy

**Part IX — Security and Operations**
47. Security · 48. Rate Limiting · 49. API Versioning · 50. Health Checks ·
51. Monitoring · 52. Metrics · 53. OpenTelemetry Readiness

**Part X — Testing and Delivery**
54. Testing Strategy · 55. Unit Tests · 56. Integration Tests ·
57. Contract Tests · 58. Deployment Strategy · 59. Scalability ·
60. Definition of Done

**Part XI — Module Catalog** (33 modules)
**Part XII — Background Jobs Catalog** (15 jobs)
**Appendix A** — Redis Keyspace Reference
**Appendix B** — Security Checklist Reference

---

# PART I — FOUNDATIONS

## 1. Backend Philosophy

1. **The backend is the only trusted party.** Every rule in
   `BOOKING_ENGINE_ARCHITECTURE.md` about availability, holds, and pricing
   being authoritative is enforced *here*, in this layer, against this
   database — never assumed to have been correctly checked upstream by
   any client. `FRONTEND_ARCHITECTURE.md` §20.2 puts this from the
   client's side ("the frontend never calculates authoritative prices");
   this document is the other half of that promise.
2. **Clean Architecture, strictly layered.** Business logic never depends
   on Express, MySQL, or Redis directly — it depends on interfaces
   (Chapter 3). This is not academic purity; it is what allows the
   Booking Engine's core rules to be unit-tested in milliseconds without
   a database, and what allows a future infrastructure change (a
   different queue, a different cache) to happen without touching a
   single business rule.
3. **SOLID, DRY, KISS as daily practice, not a poster on the wall.**
   Concretely: one class, one reason to change (Single Responsibility);
   new module types extend rather than modify shared engine code
   (Open/Closed — this is *why* `BOOKING_ENGINE_ARCHITECTURE.md` Appendix
   A's module-mapping pattern exists); a `Service` depends on a
   `Repository` interface, never a concrete MySQL client (Dependency
   Inversion). A rule or calculation is defined exactly once (DRY — the
   pricing pipeline, `BOOKING_ENGINE_ARCHITECTURE.md` §7.1, has exactly
   one implementation, called by every path that needs a price). The
   simplest design that satisfies the requirement ships — speculative
   generality for hypothetical future needs is rejected (KISS).
4. **Every module is independently testable.** A `Service` can be
   unit-tested with an in-memory fake `Repository`; a `Controller` can be
   tested with a mocked `Service`. No test in this codebase requires a
   running MySQL instance, Redis instance, and payment gateway
   simultaneously just to verify one business rule (Chapter 54).
5. **Correctness under concurrency is a first-class design constraint,
   not a bug class.** `BOOKING_ENGINE_ARCHITECTURE.md` §15.1's race-
   condition guarantee is implemented here through the concrete
   mechanisms in Chapters 40–43 (transactions, optimistic locking,
   distributed locking, idempotency) — every one of those chapters exists
   because a specific concurrency failure mode was identified and closed.
6. **The system is built for horizontal scale from day one**, per
   `DATABASE_ARCHITECTURE.md` §15 and `BOOKING_ENGINE_ARCHITECTURE.md`
   §16: the application layer is stateless (Chapter 12's token strategy,
   Chapter 38's session handling), so scaling from one instance to
   fifty is an infrastructure change, never a code change.

## 2. Project Folder Structure

```
src/
  modules/                    — one folder per business module (Part XI)
    {module}/
      controllers/
      services/
      repositories/
      models/
      dto/
      validators/
      events/
      jobs/
      module.routes.js         (route wiring only — no logic; endpoints per API_SPECIFICATION.md)
      module.container.js      (DI registration, Ch. 17)
  core/                        — Clean Architecture's inner layers, shared
    domain/                    — entities, value objects, domain services (Ch. 3)
    use-cases/                 — cross-module application logic (e.g., the confirm-hold use case, Ch. 26)
    interfaces/                — repository/service interfaces (ports, Ch. 3)
  infrastructure/              — Clean Architecture's outer layer (adapters, Ch. 3)
    database/                  — MySQL connection, migrations, repository implementations
    cache/                     — Redis client wrapper (Ch. 38)
    queue/                     — BullMQ setup (Ch. 35)
    storage/                   — Cloud storage adapter (Ch. 30)
    email/                     — Email provider adapter (Ch. 33)
    sms/                       — SMS provider adapter (Ch. 34)
    payment/                   — Payment gateway adapter (Ch. 29)
    search/                    — Search index adapter (Ch. 46)
  middleware/                  — Express middleware (Ch. 11)
  guards/                      — authorization guard middleware (Ch. 13-16)
  errors/                      — exception hierarchy (Ch. 24)
  validation/                  — shared validation pipeline plumbing (Ch. 25)
  logging/                     — logger setup (Ch. 20)
  monitoring/                  — health checks, metrics, tracing (Ch. 50-53)
  config/                      — configuration loader (Ch. 18-19)
  container/                   — root DI container composition (Ch. 17)
  jobs/                        — scheduled-job definitions not owned by one module (Ch. 37)
  app.js                       — Express app assembly (middleware + routes composition)
  server.js                    — process entry point (listen, graceful shutdown)
tests/
  unit/
  integration/
  contract/
  fixtures/
```

**Rule:** a module's `controllers/`, `services/`, `repositories/` etc. are
never imported directly by another module — cross-module interaction goes
through a module's public `services/` interface only, registered in the
DI container (Chapter 17), mirroring `FRONTEND_ARCHITECTURE.md` §6.3's
identical cross-module discipline on the frontend. The backend and
frontend module boundaries are intentionally named and shaped alike
(`bookings`, `booking-holds`, `availability`, `pricing`, `payments`, ...)
so an engineer moving between the two codebases recognizes the same
domain seams immediately.


## 3. Clean Architecture Layers

### 3.1 The Four Layers

```
┌─────────────────────────────────────────────────────────┐
│  Infrastructure (adapters)                               │
│  Express routes · MySQL driver · Redis client · BullMQ   │
│  Cloud storage SDK · Email/SMS/Payment gateway SDKs       │
├─────────────────────────────────────────────────────────┤
│  Interface Adapters                                       │
│  Controllers · Repositories (implementations) · DTOs      │
│  Presenters (response shaping to API_SPECIFICATION.md)    │
├─────────────────────────────────────────────────────────┤
│  Application (use cases)                                  │
│  Services · Use Cases · Validators · Domain Events        │
├─────────────────────────────────────────────────────────┤
│  Domain (entities)                                         │
│  Entities · Value Objects · Domain Rules · Interfaces (ports) │
└─────────────────────────────────────────────────────────┘
```

**The Dependency Rule:** dependencies point only inward. Domain knows
nothing about Application; Application knows nothing about Interface
Adapters; nothing in any inner layer imports Express, a MySQL driver, or
any SDK directly. Outer layers depend on inner layers' **interfaces**
(ports), and inner layers never depend on outer layers' concrete
implementations — this is Dependency Inversion (Chapter 17) applied
architecture-wide, not just to individual classes.

### 3.2 What Lives in Each Layer

- **Domain** — the platform's actual business rules that are true
  regardless of framework: a `ReservationHold`'s 15-minute expiry rule
  (`BOOKING_ENGINE_ARCHITECTURE.md` §5.2), a `CancellationPolicy`'s
  tiered refund-percentage resolution (§9.2), a `Money` value object's
  currency-pairing invariant (`DATABASE_ARCHITECTURE.md` §1). These are
  plain objects/functions with zero imports from `infrastructure/`.
- **Application** — orchestration of domain rules into a use case: "confirm
  a booking hold" coordinates the `ReservationHold` domain rule, the
  `PricingEngine` port, the `PaymentGateway` port, and the
  `BookingRepository` port, in the sequence
  `BOOKING_ENGINE_ARCHITECTURE.md` §3.3 specifies — but the Application
  layer only ever calls **interfaces**, never a concrete MySQL query or a
  concrete Stripe-equivalent SDK call.
- **Interface Adapters** — translates between the outside world and the
  Application layer: a Controller takes an Express `req`, builds a DTO
  (Chapter 9), calls a Service (Application layer), and shapes the
  result into the exact response envelope `API_SPECIFICATION.md` §8
  requires; a Repository *implementation* translates a domain entity
  into MySQL queries.
- **Infrastructure** — the concrete, swappable technology: Express
  itself, the `mysql2` driver, the Redis client, BullMQ, the cloud
  storage SDK, the email/SMS/payment gateway SDKs.

### 3.3 Why This Matters at This Platform's Scale

Every rule in `BOOKING_ENGINE_ARCHITECTURE.md` — the four availability
algorithms (§4.2), the hold lifecycle (§5), the cancellation resolution
algorithm (§9.2) — is domain/application logic that must be provably
correct independent of *which* database or cache technology executes it.
Clean layering is what lets Chapter 55's unit tests exercise these rules
in milliseconds, in-memory, with zero infrastructure — and what lets
Chapter 58's deployment strategy swap infrastructure (e.g., a read
replica pool, a different queue backend) without touching a single
business rule.

---

# PART II — MODULE & LAYER ARCHITECTURE

## 4. Module Architecture

Every module under `src/modules/` (Part XI's 33 modules) is a
**vertical slice** through all four Clean Architecture layers for one
business domain — not a horizontal layer shared across domains. A
module owns its own Controllers, Services, Repositories, Models, DTOs,
Validators, domain Events, and Queue Jobs, and exposes exactly one
public surface: the Services registered in its `module.container.js`
(Chapter 17). Every module maps to one or more `API_SPECIFICATION.md`
Part II modules and one or more `DATABASE_ARCHITECTURE.md` domains — Part
XI's catalog makes this mapping explicit per module.

**Cross-module rule (restated from Chapter 2):** Module A may call
Module B's public Service interface; Module A may never import Module
B's Repository, Model, or internal Controller directly. This mirrors
`FRONTEND_ARCHITECTURE.md` §6.3 exactly, and for the same reason: it is
what keeps `bookings` from silently depending on `payments`' internal
MySQL query shape, so either can evolve its internals independently.

## 5. Controllers

- **Sole responsibility:** translate an HTTP request into a Service call,
  and a Service's result into the exact response shape
  `API_SPECIFICATION.md` requires (envelope, pagination meta, error
  format) — a Controller contains **zero business logic**. If a
  Controller method is more than "parse input → build DTO → call Service
  → shape response," logic has leaked into the wrong layer.
- Controllers never touch a Repository or a Model directly, never open a
  database transaction, and never call an external SDK directly — all of
  that is a Service's responsibility (Chapter 6).
- Controllers are the layer at which the response envelope (`success`,
  `data`, `meta`, `error` — `API_SPECIFICATION.md` §8) and HTTP status
  code selection (§21) are finalized — a Service returns domain
  data/throws a domain exception; the Controller (with the global error
  middleware, Chapter 23) is what turns that into the wire format.

## 6. Services

- **Sole responsibility:** implement one module's use cases — the
  Application layer's orchestration logic (Chapter 3.2). A Service
  calls Repository interfaces (never a concrete database driver),
  Domain entities/rules, and other modules' public Service interfaces.
- Every Service method that mutates shared, contended state (holds,
  availability, payments) explicitly declares and enforces its own
  transaction boundary (Chapter 40) and locking requirement (Chapters
  41–42) — this is never left implicit or delegated silently to the
  Repository layer.
- A Service is the layer where a module's **public** vs. **internal**
  distinction (required per module in Part XI) is enforced: public
  Services are registered in `module.container.js` and callable by other
  modules; internal Services exist only to be composed by that module's
  own public Services and are never exported.

## 7. Repositories

- **Sole responsibility:** the only place in the codebase that
  constructs a database query — implementing a Domain-layer-defined
  interface (a "port"), per Chapter 3.1's Dependency Rule. A Service asks
  a `BookingRepository` interface for "the confirmed bookings for this
  user"; the concrete `MySqlBookingRepository` implementation is what
  actually knows about `DATABASE_ARCHITECTURE.md`'s table and column
  names.
- Repositories return **domain entities/Models** (Chapter 8), never raw
  database rows — the translation from a MySQL row shape to a domain
  Model happens exactly once, inside the Repository implementation.
- Repositories never contain business logic (a repository does not decide
  *whether* a booking can be cancelled — it only fetches/persists what a
  Service, which does know that rule, tells it to) and never span more
  than one bounded aggregate's persistence concern per method — a
  multi-table, multi-aggregate write (Chapter 40's transaction examples)
  is orchestrated by a Service calling multiple Repositories inside one
  transaction, not by one Repository method silently writing to five
  tables.

## 8. Models

- Domain-layer representations of the platform's core entities —
  `Listing`, `BookableUnit`, `ReservationHold`, `Booking`, `Payment` —
  mirroring `DATABASE_ARCHITECTURE.md`'s table shapes exactly in their
  field names (Chapter 1's DRY principle: a field is never renamed
  between the database, the Model, and the API DTO without reason) but
  expressed as plain domain objects, not MySQL-driver row objects and not
  Express-aware objects.
- Models may carry small, genuinely domain-owned behavior (a `Booking`
  model exposing an `isCancellable()` check derived from its `status` and
  the current time, matching `BOOKING_ENGINE_ARCHITECTURE.md` §3.4's
  terminal-state rule) — but any behavior requiring a database read,
  an external call, or cross-entity orchestration belongs in a Service,
  never a Model.

## 9. DTOs

- **Data Transfer Objects** are the explicit, versioned shape of data
  crossing a layer boundary — request DTOs (Controller → Service input,
  matching `API_SPECIFICATION.md`'s documented request body per endpoint
  exactly) and response DTOs (Service → Controller output, matching the
  documented response body).
- A DTO is never the same object as a Model (Chapter 8) or a database row
  — a Model may carry internal fields (e.g., a soft-delete `deleted_at`)
  that a response DTO deliberately omits, and this translation is always
  explicit, never accidental (an accidentally-leaked internal field
  through a Model-as-response shortcut is exactly the class of bug DTOs
  exist to prevent).
- DTO shapes are the object that Chapter 57's contract tests validate
  against the published OpenAPI bundle (`API_SPECIFICATION.md` §26) —
  a DTO is the concrete implementation of one of that bundle's schema
  components.

## 10. Validators

- Implement the API-layer validation described in
  `API_SPECIFICATION.md` §10 and `BOOKING_ENGINE_ARCHITECTURE.md` §11.1's
  "Layer 2" — structural and format validation (required fields, types,
  ranges, enum membership against a module's lookup-table values) *before*
  a request DTO is handed to a Service.
- Validators never perform a database lookup themselves (checking "does
  this `bookable_unit_id` exist and belong to an active listing" is a
  Service-layer concern, since it requires a Repository call) — a
  Validator's job is confined to what can be determined from the request
  payload alone, keeping validation fast and side-effect-free.
- Every Validator's rule set is required to match its corresponding
  `API_SPECIFICATION.md` endpoint's documented Validation Rules exactly
  — this is enforced procedurally by Chapter 57's contract tests, not
  left to manual review alone.

## 11. Middleware

Applied at the Express layer (Infrastructure), composed once per
application entry, never duplicated per route:

- **Request context** — assigns a `request_id` (`API_SPECIFICATION.md`
  §9) to every incoming request, attached to all downstream logging
  (Chapter 20).
- **Authentication** — verifies the JWT (Chapter 12), attaches the
  resolved principal to the request context.
- **Locale/currency** — resolves `Accept-Language` and
  `display_currency` (`API_SPECIFICATION.md` §15) once, attaching them to
  the request context so no Service re-parses them.
- **Rate limiting** (Chapter 48), **Idempotency-Key** enforcement
  (Chapter 43), **Helmet** security headers, **CORS** (Chapter 47) —
  each its own single-responsibility middleware, composed in a fixed,
  documented order (security headers and CORS first, then request
  context, then auth, then rate limiting, then idempotency, then route
  handling) so the order itself is part of this contract, not an
  incidental accident of the codebase's history.
- **Global error-handling middleware** (Chapter 23) — the single place
  that catches every thrown exception (Chapter 24) and shapes the final
  error response envelope.


---

# PART III — IDENTITY, ACCESS, AND PLATFORM PLUMBING

## 12. Authentication

- Implements `API_SPECIFICATION.md` §4/§6/§7 and
  `FRONTEND_ARCHITECTURE.md` §34.1's web-specific delivery requirement
  exactly: access tokens are short-lived (15 minutes) signed JWTs,
  verified statelessly on every request (no database round-trip to check
  an access token's validity — only its signature and expiry) so
  authentication never becomes a bottleneck as instance count scales
  (Chapter 59).
- Refresh tokens are persisted server-side (hashed, never in plaintext)
  against the issuing user and device, enabling the rotation,
  reuse-detection, and logout-all mechanics `API_SPECIFICATION.md` §7
  specifies. For web clients (identified via the `X-Client` header,
  `FRONTEND_ARCHITECTURE.md` §10.1), the auth Service additionally issues
  the refresh token as a `Secure`, `HttpOnly`, `SameSite=Strict` cookie on
  the same response that returns it in the JSON body for native clients
  — one Service implementation, two delivery channels, selected by
  request context, never two divergent code paths.
- Password hashing uses a modern, adaptive, salted algorithm (Argon2id)
  with per-deployment-tunable work factor (Chapter 18), never a fast
  general-purpose hash.
- Login-attempt lockout (`ACCOUNT_LOCKED`, `API_SPECIFICATION.md`
  Appendix A) is tracked in Redis (Chapter 38) — a sliding-window counter
  keyed by account, not by IP alone, so distributed attempts against one
  account are still caught regardless of source IP diversity.

## 13. Authorization

- Every non-public endpoint's permission requirement
  (`API_SPECIFICATION.md` Part II, Appendix B) is enforced by a guard
  middleware (Chapter 11) that resolves the request's principal, looks up
  its current roles/permissions (Chapter 14), and rejects with `403
  FORBIDDEN` before any Controller code runs — authorization is a
  cross-cutting concern applied uniformly, never re-implemented per
  Controller.
- **Ownership checks** (a partner accessing only their own listings, a
  customer accessing only their own bookings) are enforced one layer
  deeper, inside the Service (Chapter 6), since they require loading the
  specific resource to compare its owning `partner_id`/`user_id` against
  the request principal — this mirrors
  `API_SPECIFICATION.md` §5's "Owner or `{permission}`" pattern and
  `FRONTEND_ARCHITECTURE.md` §4.4's identical layering decision on the
  frontend side.
- Authorization decisions are never cached longer than the permission-
  resolution cache TTL defined in Chapter 39 — a revoked permission takes
  effect platform-wide within that bound, matching
  `API_SPECIFICATION.md` §18's documented behavior.

## 14. RBAC

- Implements `DATABASE_ARCHITECTURE.md` §4.1's `roles`/`permissions`/
  `role_user`/`permission_role` model exactly: a role is a named bundle
  of permission keys; a user (or partner-employee, per Chapter 15) holds
  one or more roles; every enforcement check is against a **permission
  key**, never a role name directly (a Controller/Service never checks
  `if role === 'partner_manager'`; it checks `if hasPermission('listing.update')`)
  — this indirection is what let `API_SPECIFICATION.md` Appendix B's
  fine-grained key catalog exist independently of the seven seeded roles.
- Role/permission resolution for a given principal is computed once per
  request (from the JWT's role claims plus a Redis-cached permission
  lookup, Chapter 39) and attached to request context — never
  re-resolved redundantly by multiple middleware/guards in the same
  request.

## 15. Partner Permissions

- Implements the partner-scoped RBAC layer from
  `DATABASE_ARCHITECTURE.md` §9 and `API_SPECIFICATION.md` §32: a
  `partner_employees` row scopes a role (`partner_owner`,
  `partner_manager`, `partner_staff`) to exactly one `partner_id`. Every
  partner-scoped guard resolves **both** the permission key **and** the
  matching `partner_id` from the request's token/route context — a
  partner-employee token is never sufficient on its own; it must match
  the specific partner resource being acted on.
- The "last owner cannot be removed" business rule
  (`API_SPECIFICATION.md` §32) is enforced in the Employees module's
  Service layer (Chapter 6), never left to a database constraint alone,
  since it requires a business-meaningful count check, not just
  referential integrity.

## 16. Admin Permissions

- Global roles (`super_admin`, `admin`, `moderator`) carry
  platform-wide permission keys, never scoped to a `partner_id`.
  `user.purge` (`API_SPECIFICATION.md` §68) is restricted to
  `super_admin` exclusively, enforced as an explicit, separate guard
  check beyond the standard permission lookup — a deliberately
  non-generic, hardcoded extra check for the one operation on the
  platform that performs an irreversible hard delete
  (`DATABASE_ARCHITECTURE.md` §7's soft-delete-only default has exactly
  one sanctioned exception, and this is it).
- Impersonation (`API_SPECIFICATION.md` §68) issues a distinct,
  time-boxed (30-minute, non-refreshable) token carrying an `acted_as`
  claim; every downstream audit log write (Chapter 21) includes that
  claim automatically via request context, never requiring each Service
  to remember to pass it through manually.

## 17. Dependency Injection Strategy

- **Constructor injection, composed via a lightweight, explicit container**
  — not a heavyweight DI framework with runtime reflection/decorators
  (unnecessary complexity for this stack's plain-JavaScript codebase,
  violating Chapter 1's KISS principle), and not a service-locator
  anti-pattern (where a class reaches into a global registry itself,
  hiding its real dependencies).
- Every Service/Repository declares its dependencies as constructor
  parameters, typed against an interface (Chapter 3's ports); each
  module's `module.container.js` (Chapter 2) wires the concrete
  implementation to the interface **once**, at application bootstrap
  (`app.js`); nothing below the container composition root ever
  constructs its own dependency with `new` on a concrete infrastructure
  class.
- This is what makes Chapter 55's unit tests trivial: a test constructs a
  Service directly, passing a hand-written fake Repository that satisfies
  the same interface — no container, no database, no mocking framework
  reaching into module internals required.

## 18. Configuration Management

- All configuration (database connection parameters, Redis connection,
  queue concurrency settings, JWT signing keys, cache TTLs, the
  15-minute hold duration default, provider API keys) is loaded once at
  startup through a single `config/` module that validates every value's
  presence and type **before** the application accepts its first
  request — a missing or malformed required configuration value is a
  fail-fast startup error, never a runtime surprise on the first request
  that happens to need it.
- Configuration values that are also exposed publicly via
  `GET /settings/public` (`API_SPECIFICATION.md` §67, e.g., the hold
  duration) are read from the same underlying `system_settings` table
  (`DATABASE_ARCHITECTURE.md` §4.10) the Settings module manages — not
  duplicated as a separate hardcoded constant that could drift from what
  the API actually reports.

## 19. Environment Variables

- Three environments (`development`, `staging`, `production`), each with
  its own variable set, injected at process start — never committed to
  source control, never logged (Chapter 20's redaction rule applies
  identically on the backend), and validated against a required-keys
  schema at startup (Chapter 18).
- Categories: database credentials, Redis connection string, JWT signing
  secret(s) (with support for key rotation — two active signing keys
  during a rotation window, old-key-signed tokens still verified until
  their natural expiry), cloud storage credentials, payment gateway
  API keys, email/SMS provider credentials, monitoring/tracing endpoint.
- **No secret is ever bundled into any artifact shared with the frontend
  build** (`FRONTEND_ARCHITECTURE.md` §37 states the frontend-side half of
  this rule; this is the backend-side guarantee that no such secret is
  ever exposed through an API response, error message, or log line
  reachable by a client).


---

# PART IV — OBSERVABILITY AND ERRORS

## 20. Logging Strategy

- Structured (JSON) logging exclusively — never a bare `console.log`
  string — so every log line is queryable by field (request ID, user ID,
  module, level) in the monitoring pipeline (Chapter 51).
- Every log line carries: `timestamp`, `level`, `request_id`
  (propagated from Chapter 11's request-context middleware through every
  layer), `module`, `message`, and structured `context` fields relevant
  to the event.
- **Redaction is automatic and centralized**, not per-call-site:
  a single logger wrapper strips known-sensitive field names (passwords,
  tokens, full card references, raw payment-gateway payloads) before any
  line is emitted, mirroring `FRONTEND_ARCHITECTURE.md` §36.2's identical
  rule on the client side — the same discipline enforced on both ends of
  the stack.
- Log levels are used with fixed meaning platform-wide: `error` (an
  exception that affected the request's outcome), `warn` (a degraded-but-
  handled condition, e.g. Redis lock fallback per
  `BOOKING_ENGINE_ARCHITECTURE.md` §15.2), `info` (a significant
  lifecycle event — booking confirmed, payment captured), `debug`
  (verbose, disabled by default in production).

## 21. Audit Logs

- Implements `DATABASE_ARCHITECTURE.md` §4.10's `audit_logs` table and
  `BOOKING_ENGINE_ARCHITECTURE.md` §15.7's requirement exactly: every
  privileged action, every booking-lifecycle transition
  (`BOOKING_ENGINE_ARCHITECTURE.md` §3.3), every admin calendar/pricing
  override, and every check-in/check-out action writes an insert-only
  `audit_logs` row — `auditable_type`, `auditable_id`, `actor_id`,
  `action`, `old_values`/`new_values` JSON diff, `created_at`.
- Audit writes are performed **inside the same database transaction**
  (Chapter 40) as the state change they record wherever the change is a
  synchronous, request-scoped operation (e.g., booking confirmation) —
  never as a best-effort, fire-and-forget side call that could
  succeed independently of the change it's supposed to document.
- For asynchronous events (a background job's action, Chapter 36), the
  audit write happens within that job's own transaction, with the same
  atomicity guarantee.
- A single, shared `AuditLogger` service (injected via Chapter 17,
  callable from any module) is the **only** sanctioned way to write to
  `audit_logs` — no module writes to this table via its own ad hoc
  Repository call, keeping the shape and required fields consistent
  platform-wide.

## 22. Activity Logs

- Implements `DATABASE_ARCHITECTURE.md` §4.10's `activity_logs` table —
  distinguished from Audit Logs by scope and purpose: Activity Logs are a
  lighter-weight, non-diff, general activity feed (a user viewed a
  listing, a partner exported a report) used for engagement analytics
  and support context, not for compliance/dispute evidence.
- Unlike Audit Logs, Activity Log writes are **non-blocking** — queued
  (Chapter 35) rather than written synchronously in the request path,
  since losing an occasional activity-log entry under extreme load is an
  acceptable tradeoff that an audit-log loss would never be.

## 23. Error Handling

- One global Express error-handling middleware (Chapter 11, last in the
  middleware chain) is the **only** place that converts a thrown
  exception into an HTTP response — no Controller contains its own
  `try/catch`-to-response logic; a Controller either succeeds or lets its
  exception propagate.
- The global handler: (1) resolves the exception's type against the
  Exception Hierarchy (Chapter 24), (2) maps it to the correct HTTP
  status and `API_SPECIFICATION.md` Appendix A error code, (3) logs it at
  the appropriate level (Chapter 20) with full context, (4) strips any
  internal detail (stack traces, raw database errors) from the
  client-facing response in production, replacing it with the safe,
  documented `error.message`, while still logging the full internal
  detail server-side for debugging.
- An unrecognized/unexpected exception type is always treated as
  `INTERNAL_ERROR` (500) — the handler never lets an unmapped exception
  leak a raw stack trace or driver-specific error message to a client.

## 24. Exception Hierarchy

A small, closed hierarchy of custom exception classes, each carrying its
own `API_SPECIFICATION.md` Appendix A error code and HTTP status,
thrown by Services/Repositories and caught only by the global handler
(Chapter 23):

```
AppError (base — code, httpStatus, message, details)
├── ValidationError            → 422 VALIDATION_FAILED
├── AuthenticationError         → 401 (UNAUTHENTICATED and its specific subtypes)
├── AuthorizationError          → 403 (FORBIDDEN and its specific subtypes)
├── NotFoundError               → 404 NOT_FOUND
├── ConflictError               → 409 (AVAILABILITY_CONFLICT, HOLD_EXPIRED, etc.)
├── RateLimitError               → 429 RATE_LIMITED
├── ExternalServiceError        → 502/503 (payment gateway, storage, provider failures)
└── InternalError                → 500 INTERNAL_ERROR
```

Every module-specific error (`HOLD_EXPIRED`, `BOOKING_NOT_CANCELLABLE`,
`PARTNER_NOT_VERIFIED`) is a named, specific instance of one of these
base classes — carrying its exact Appendix A code — never a raw string
thrown or a generic `Error`. This is what lets Chapter 23's global
handler be a simple, total mapping rather than a sprawling set of special
cases.

## 25. Validation Pipeline

Implements `API_SPECIFICATION.md` §10 and
`BOOKING_ENGINE_ARCHITECTURE.md` §11.1's three-layer model, Layers 2 and
3 specifically (Layer 1 is the frontend's concern,
`FRONTEND_ARCHITECTURE.md` §15.2):

1. **Layer 2 — Structural validation** (Chapter 10's Validators): runs
   immediately after Chapter 11's auth/rate-limit middleware, before any
   Controller/Service code — a structurally invalid request never
   reaches business logic at all, failing fast with `422
   VALIDATION_FAILED` and field-level `details` (`API_SPECIFICATION.md`
   §9).
2. **Layer 3 — Transactional, lock-protected validation** (Chapters
   26–27, 40–42): re-checks business-meaningful state (availability,
   capacity, blackout dates) at the moment of commitment, inside the
   relevant transaction/lock — this is never skipped on the assumption
   that Layer 2 or the frontend's Layer 1 already confirmed correctness.

Every endpoint's validation rules are defined **once**, in that module's
`validators/` (Layer 2) and Service-layer business rule checks (Layer 3)
— matching `API_SPECIFICATION.md`'s per-endpoint Validation Rules
documentation exactly, verified by Chapter 57's contract tests so the
implementation and the published contract can never silently drift apart.


---

# PART V — ENGINE INTEGRATIONS

## 26. Booking Engine Integration

- The `bookings` and `booking-holds` modules (Part XI) are the concrete
  implementation of every state transition in
  `BOOKING_ENGINE_ARCHITECTURE.md` §3 — the Domain layer (Chapter 3)
  encodes the state machine itself (which transitions are legal from
  which state) as a small, framework-free state-machine object; the
  Application layer's Services orchestrate a transition's full side
  effects (calendar update, invoice write, notification enqueue) inside
  one transaction (Chapter 40).
- The **confirm-hold use case** (`BOOKING_ENGINE_ARCHITECTURE.md` §3.3's
  most safety-critical transition) is implemented as a single Application-
  layer use case object (`core/use-cases/ConfirmBookingHold`) that
  orchestrates, in strict order, the Availability Engine (Chapter 27),
  the Pricing Engine (Chapter 28), the Payment Integration (Chapter 29),
  the `bookings`/`booking-holds` Repositories, and the Notification
  Service (Chapter 32) — all inside one distributed lock (Chapter 42)
  and one database transaction (Chapter 40), exactly matching
  `BOOKING_ENGINE_ARCHITECTURE.md` §15.3's transaction-boundary
  description.
- No module other than `bookings`/`booking-holds` is ever permitted to
  directly mutate a booking's `status` field — every other module
  (Payments reacting to a webhook, Reviews checking eligibility) reads
  booking state through the `bookings` module's public Service interface
  (Chapter 4's cross-module rule), never by writing to the table itself.

## 27. Availability Engine Integration

- The `availability` module implements the four algorithms from
  `BOOKING_ENGINE_ARCHITECTURE.md` §4.2 as four small, independently
  unit-testable Domain-layer strategies, selected per `bookable_unit`
  based on its configured algorithm (Appendix A of that document) — a
  single `AvailabilityChecker` port with four concrete strategy
  implementations, never one large conditional method branching on
  module type.
- The **real-time check** (`API_SPECIFICATION.md` §49,
  `BOOKING_ENGINE_ARCHITECTURE.md` §4.5) always reads with row-locking
  semantics inside the same transaction that will write a hold if the
  check passes — the availability module's read-check method and the
  booking-holds module's write method are two calls composed by the
  Chapter 26 use case within one transaction, never two independent,
  separately-committed operations.
- The eventually-consistent search index (Chapter 46) is fed from this
  module's write events (§Events, Part XI) via the same change-data-
  pattern described in `BOOKING_ENGINE_ARCHITECTURE.md` §16.3 — the
  Availability module never writes to the search index synchronously
  inside its own transaction; it publishes a domain event, consumed
  asynchronously (Chapter 35).

## 28. Pricing Engine Integration

- The `pricing` module implements the full pipeline from
  `BOOKING_ENGINE_ARCHITECTURE.md` §7.1 as an ordered chain of small,
  single-responsibility calculator objects (base → seasonal/weekend/
  holiday/special → dynamic → discounts → coupons → subtotal → taxes →
  service fee → total → commission → payout amount), each independently
  unit-testable and composed by one `PriceResolutionService` — adding a
  new pricing rule type means adding one new calculator to the chain,
  never modifying the others (Open/Closed, Chapter 1).
- `POST /pricing/quote` (`API_SPECIFICATION.md` §51) and the
  hold-creation flow (Chapter 26) call the **exact same**
  `PriceResolutionService` — there is exactly one implementation of this
  pipeline in the codebase, matching
  `BOOKING_ENGINE_ARCHITECTURE.md` §7.1's "every stage's output is
  written as an invoice line item" principle: the pipeline's output
  shape is the same whether it's being previewed or being committed.
- Price snapshotting at hold-creation time
  (`BOOKING_ENGINE_ARCHITECTURE.md` §7.7) is enforced by the Pricing
  module never being re-invoked once a hold exists — the confirm-hold
  use case (Chapter 26) reads the **already-computed, stored** price from
  the hold record, never re-running the pipeline against
  possibly-changed rules.

## 29. Payment Integration

- The `payments` module depends on a `PaymentGatewayPort` interface
  (Chapter 3), with a concrete adapter implementation living in
  `infrastructure/payment/` — the Application layer's payment Services
  never import a gateway SDK directly, which is what makes a future
  gateway migration or a multi-gateway strategy (Chapter 45) an
  infrastructure-layer change only.
- Implements `BOOKING_ENGINE_ARCHITECTURE.md` §8 exactly: authorize/
  capture (immediate or delayed per §8.2), wallet debit (§8.3, checked
  and applied before any external gateway call), failure handling
  preserving the active hold (§8.4), refund/partial refund (§8.5) always
  referencing the originating cancellation decision, payout batching
  (§8.6) as a scheduled job (Chapter 37), webhook-driven state updates
  (§8.7, Chapter 44) processed idempotently (Chapter 43), and chargeback
  handling (§8.8) crediting the partner's *next* payout batch rather than
  reversing an already-settled one.
- Every payment state transition writes both a `payments` row update and
  a `payment_transactions` append-only log entry (`DATABASE_ARCHITECTURE.md`
  §4.8) inside the same transaction — the transaction log is never a
  best-effort side write.


---

# PART VI — MEDIA AND COMMUNICATION

## 30. File Upload Pipeline

- Implements the three-step, pre-signed-URL flow from
  `API_SPECIFICATION.md` §19 exactly: the `media` module's
  `upload-intent` Service validates declared type/size against
  module-specific constraints, requests a short-lived pre-signed URL from
  the `infrastructure/storage/` adapter (never proxying the binary
  through the application server itself — object storage receives the
  upload directly), and the `confirm` Service verifies the object exists
  in storage before writing the `media` row.
- File-type validation is performed **twice**, server-side: once against
  the client's declared MIME type at intent time (fast, cheap rejection),
  and once by inspecting the actual uploaded file's signature/magic bytes
  after upload, before confirming — a mismatch here (a client claiming
  `image/png` for an executable) is rejected at confirmation, never
  trusted from the declared type alone.
- Maximum size and allowed-type constraints per context (image vs. video,
  per-partner-tier limits) are configuration-driven (Chapter 18), not
  hardcoded per module.

## 31. Image Processing Pipeline

- Triggered asynchronously (a BullMQ job, Chapter 36) after upload
  confirmation — never synchronously in the request path, since
  transcoding/resizing is comparatively slow work that must not block
  the API response.
- Generates the standard responsive variants
  (`thumbnail`/`medium`/`large`/`original`) `API_SPECIFICATION.md` §20
  requires, writes each variant's URL back onto the `media` row, and
  emits a domain event (`media.processed`) that the owning module (e.g.,
  `listings`) can react to (e.g., marking a listing's publish-readiness
  check, `API_SPECIFICATION.md` §38, as satisfied once at least one image
  has finished processing).
- Video transcoding (adaptive streaming manifest generation) follows the
  identical asynchronous pattern, with a longer expected job duration
  budgeted for in the queue's concurrency/priority configuration
  (Chapter 36).

## 32. Notification Service

- Implements `BOOKING_ENGINE_ARCHITECTURE.md` §10 exactly: every
  booking-lifecycle transition (Chapter 26) **enqueues** a notification
  event (never sends synchronously in the request path) referencing the
  applicable `notification_templates` code
  (`DATABASE_ARCHITECTURE.md` §4.9) — decoupling notification delivery
  from the transaction that triggered it entirely, matching
  `BOOKING_ENGINE_ARCHITECTURE.md` §10.1's explicit design intent.
- One `NotificationService` public interface, called by every module that
  needs to notify a user/partner/admin — internally, it resolves the
  recipient's channel preferences (`notification_preferences`), renders
  the localized template (Chapter 33/34 for the two external channels;
  in-app/push handled by this module directly), and dispatches to the
  correct channel-specific queue (Chapter 35).
- Always writes the durable, in-app `notifications` row **regardless**
  of the recipient's channel opt-outs (`API_SPECIFICATION.md` §55's
  documented behavior) — channel preferences only gate whether Email/SMS/
  Push are *additionally* sent.

## 33. Email Service

- An `infrastructure/email/` adapter behind an `EmailSenderPort`
  interface — the Notification Service (Chapter 32) never imports the
  concrete email-provider SDK directly, enabling a future provider
  migration without touching Application-layer code.
- Templates are rendered server-side, per-locale, using the same
  `notification_templates`/translation data the API/database already own
  (`DATABASE_ARCHITECTURE.md` §4.9) — never a template hardcoded into the
  Email Service itself.
- Delivery is processed via a dedicated BullMQ queue (Chapter 35/36) with
  its own retry policy (exponential backoff, bounded attempts,
  `BOOKING_ENGINE_ARCHITECTURE.md` §10.3), and every send is idempotent
  by the notification event's own ID (Chapter 43), so a queue redelivery
  never double-sends the same email.

## 34. SMS Service

- Structurally identical to the Email Service (its own
  `infrastructure/sms/` adapter behind an `SmsSenderPort`, its own
  BullMQ queue) — reserved, per
  `BOOKING_ENGINE_ARCHITECTURE.md` §10.2, for genuinely time-sensitive,
  high-urgency events (booking confirmation, check-in reminders,
  partner-initiated cancellations) where cost-per-message justifies a
  narrower trigger list than Email's.
- Respects `notification_preferences` opt-out identically to Email, and
  is skipped automatically (with a logged reason, Chapter 20) for a
  recipient with no verified phone number, rather than failing the
  triggering transaction.


---

# PART VII — ASYNC, CONCURRENCY, AND DATA INTEGRITY

## 35. Queue Architecture

- **BullMQ on Redis** is the platform's sole asynchronous job mechanism,
  implementing `BOOKING_ENGINE_ARCHITECTURE.md` §15.4's queueing
  principle: anything not required to complete before the API responds
  is a queued job, never inline work in the request path.
- Queues are organized **per concern, not per module** — a shared
  `notifications` queue (with per-channel sub-queues for email/SMS/push,
  Chapters 32–34), a `media-processing` queue (Chapter 31), a
  `search-indexing` queue (Chapter 46), a `webhooks` queue (outbound,
  Chapter 44), and a `scheduled-jobs` queue (Chapter 37's recurring jobs)
  — this grouping is what lets each queue have its own tuned concurrency,
  priority, and retry policy independent of which module produced the
  job.
- Every job payload is small and reference-based (IDs, never full
  serialized entities) — a job handler re-fetches current state from the
  database/Repository at execution time, never trusting a payload
  snapshot that may be stale by the time the job actually runs.
- Every job is idempotent by design (Chapter 43) — BullMQ's at-least-once
  delivery guarantee means any job can be redelivered, and a job handler
  that isn't safe to run twice is treated as a defect, not an acceptable
  risk.

## 36. BullMQ Jobs

- Every job type declares, at registration: its owning module, its
  queue, its concurrency limit, its retry policy (attempt count, backoff
  strategy), and its idempotency key derivation rule.
- **Priority tiers:** time-critical jobs (hold-expiration sweep, Part
  XII) run on a high-priority, low-concurrency-limit queue configuration
  ensuring they are never starved behind bulk work (e.g., a large
  media-processing backlog); bulk/batch jobs (analytics aggregation,
  report generation) run on a separate, throughput-oriented configuration.
- **Dead-letter handling:** a job that exhausts its retry attempts moves
  to a dead-letter state, visible in the Admin Panel's operational
  tooling and alerting (Chapter 51) — never silently dropped.
- The full catalog of scheduled/background jobs is Part XII.

## 37. Scheduled Jobs

- Recurring, time-based jobs (as opposed to event-triggered jobs, which
  are enqueued directly by a Service when their triggering event occurs)
  are registered through BullMQ's repeatable-job feature, with their
  schedule defined in configuration (Chapter 18), not hardcoded — an
  operator can adjust, say, the payout batch's cadence without a code
  deploy.
- Every scheduled job is designed to be **safely re-run** if it fires
  twice in quick succession (a deploy-time restart re-registering a
  repeatable job is a known BullMQ edge case) — enforced via the same
  idempotency discipline as Chapter 36.
- Full catalog: Part XII.

## 38. Redis Architecture

Redis serves five, deliberately separated purposes — separated logically
(distinct key prefixes, Appendix A) and, at production scale, physically
(separate Redis instances/clusters per purpose once load justifies it,
per Chapter 59) so that, for example, a burst of rate-limiter traffic can
never degrade the reservation-hold distributed-locking path's latency:

| Purpose | Chapter | Key prefix |
|---|---|---|
| Cache | 39 | `cache:` |
| Distributed Lock | 42 | `lock:` |
| Session (refresh-token / device tracking, not access-token state) | 12 | `session:` |
| Rate Limiter | 48 | `ratelimit:` |
| Queue (BullMQ's own internal keyspace) | 35 | `bull:` |
| Temporary Hold (short-TTL hold-adjacent state, distinct from the authoritative `reservation_holds` MySQL table) | 42 | `hold:` |

**Why Redis holds a `hold:` lock key but never the hold's authoritative
data:** the *lock* that serializes concurrent access to a bookable unit
during hold creation/release lives in Redis (Chapter 42) because a lock
is inherently ephemeral, single-purpose coordination state; the *hold
itself* (`reservation_holds`, its `expires_at`, its price snapshot) is
durable business data and lives in MySQL, per
`DATABASE_ARCHITECTURE.md` §4.6 — Redis is never the system of record
for anything `BOOKING_ENGINE_ARCHITECTURE.md` treats as authoritative.

## 39. Cache Strategy

- **Read-through, short-TTL caching** for reference data
  (countries/regions/cities, permission catalogs — hours-long TTL, per
  `API_SPECIFICATION.md` §18) and for hot, high-read/low-write data
  (a listing's current published price display, aggregate seat counts —
  seconds-long TTL).
- **Never cached, ever:** availability, reservation holds, and any
  in-flight booking/payment state (Chapter 27's re-statement of
  `BOOKING_ENGINE_ARCHITECTURE.md` §16.3's rule) — these are always read
  fresh from MySQL within the request's transaction/lock.
- **Cache invalidation** is explicit and event-driven, never
  time-only: a write to a cached entity (e.g., a listing update)
  publishes a domain event that the caching layer subscribes to and
  invalidates the specific key immediately — TTL is a safety net for
  invalidation-event delivery failure, never the primary invalidation
  mechanism, preventing the classic stale-cache-after-write bug class.
- Permission/role resolution (Chapter 13) uses a short (60-second) TTL
  cache specifically so a permission revocation propagates platform-wide
  within a bounded, documented window even without an explicit
  invalidation event for that specific case (session/role changes are
  comparatively rare and low-risk enough that a short TTL alone is an
  acceptable, simpler mechanism here, unlike availability/pricing where
  no caching is tolerated at all).

## 40. Database Transactions

- Every multi-table write is wrapped in exactly one MySQL transaction,
  scoped to the smallest set of tables that must change atomically —
  never a transaction spanning an external network call (a payment
  gateway request, an email send) inside its boundary, since holding a
  database transaction open across a slow external call risks lock
  contention and timeout cascades; external calls happen either before
  the transaction opens (validate first) or after it commits (side
  effects triggered from a committed, durable state via a queued job,
  Chapter 35), never nested inside it.
- The confirm-hold transaction (`BOOKING_ENGINE_ARCHITECTURE.md` §15.3)
  is the canonical example: `booking_items`, `bookings`,
  `availability_calendar`, `reservation_holds` (deletion), `invoices`,
  and `invoice_items` are all touched inside one transaction; the
  **payment capture itself** (an external gateway call) happens
  immediately before this transaction opens, with only its already-
  obtained success result passed in — a payment is never captured
  "inside" the same transaction as the inventory commit, precisely
  because the gateway call cannot be rolled back by a MySQL `ROLLBACK`.
- Every transaction uses the minimum isolation level that guarantees
  correctness for its specific operation — `REPEATABLE READ` (MySQL's
  InnoDB default) for standard multi-table writes, with explicit
  `SELECT ... FOR UPDATE` row-locking (Chapter 42) layered on top for the
  specific rows a hold/booking write contends on, rather than blanket
  `SERIALIZABLE` isolation, which would needlessly serialize unrelated
  transactions platform-wide.

## 41. Optimistic Locking

- Used for **low-contention, partner-editing-their-own-data** scenarios
  where a lost-update is a rare inconvenience, not a correctness
  emergency — e.g., two staff members of the same partner editing a
  listing's description simultaneously. Every such table carries a
  version counter (or relies on `updated_at` as a version check); an
  update includes a `WHERE updated_at = :expectedUpdatedAt` (or version)
  clause, and an affected-row-count of zero is surfaced as a
  `CONFLICT`-class error (Chapter 24) prompting the client to reload and
  reapply changes — never a silent overwrite.
- **Never** used for availability/inventory/hold operations — those are
  high-contention-by-nature and require the stronger, immediate
  correctness guarantee of Distributed Locking (Chapter 42) plus
  row-level pessimistic locking, since an optimistic retry loop under
  genuine booking contention would degrade checkout latency
  unacceptably compared to the fail-fast behavior
  `BOOKING_ENGINE_ARCHITECTURE.md` §5.4 specifies.

## 42. Distributed Locking

- Implements `BOOKING_ENGINE_ARCHITECTURE.md` §5.4/§15.1/§15.2 exactly:
  a Redis-based mutual-exclusion lock (Appendix A's `lock:` keyspace),
  keyed per the specific contended resource (a `bookable_unit_id` +
  date range, or `bookable_unit_id` alone for shared-capacity units),
  acquired with a short lease (seconds, not the hold's full 15-minute
  lifetime) before any hold-creation, hold-confirmation, or hold-release
  transaction begins.
- **Failure modes, explicitly handled** (mirroring
  `BOOKING_ENGINE_ARCHITECTURE.md` §15.2): lock-acquisition timeout fails
  the request fast (`AVAILABILITY_CONFLICT`-adjacent "try again"
  response) rather than queuing; a crashed lock holder is recovered
  automatically via the lease's TTL expiry, never requiring manual
  intervention; Redis unavailability degrades the system to
  database-transaction-only locking (`SELECT ... FOR UPDATE`, Chapter 40)
  as a fallback — correctness is preserved at reduced throughput, never
  sacrificed for availability.
- The lock is always released in a `finally`-equivalent block immediately
  after the protected transaction commits or aborts — never left to a
  TTL alone under normal operation, since relying solely on TTL expiry
  for the common case would needlessly serialize unrelated requests for
  the lease's full duration.

## 43. Idempotency

- Implements `API_SPECIFICATION.md` §22 and
  `BOOKING_ENGINE_ARCHITECTURE.md` §15.5: every mutation requiring an
  `Idempotency-Key` header persists a mapping of (key → final response)
  in a dedicated, short-TTL (24-hour) store (a Redis-backed table with a
  MySQL fallback for durability past Redis's TTL if ever needed) —
  a repeated request with the same key returns the **exact original
  response** without re-executing any side effect; a repeated key with a
  materially different request body is rejected
  (`IDEMPOTENCY_KEY_CONFLICT`, 422).
- This same mechanism protects **inbound webhook processing** (Chapter
  44), keyed on the gateway's own event ID rather than a client-supplied
  header, and **queue job execution** (Chapter 35), keyed on a
  deterministic derivation from the job's own reference data (e.g., "release
  hold {holdId}" is idempotent because releasing an already-released
  hold is defined as a no-op, not an error).
- Idempotency is treated as a **cross-cutting middleware/interceptor
  concern** (Chapter 11) for HTTP-triggered mutations, not something each
  Service re-implements individually — a Service method itself is written
  to be naturally idempotent wherever feasible (e.g., "set status to
  Expired" is idempotent by construction regardless of the key
  mechanism), with the key-based response-replay layer as the outer,
  request-level guarantee.


---

# PART VIII — INTEGRATION AND SEARCH

## 44. Webhooks

- **Inbound** (payment gateway events, `API_SPECIFICATION.md` §23/§57):
  received at a dedicated, gateway-specific route, signature-verified
  against the gateway's provided scheme **before** any processing, then
  processed idempotently (Chapter 43) keyed on the gateway's event ID —
  handled by the `payments` module's Service layer, never by a bare
  Controller performing business logic directly.
- **Outbound** (partner-registered webhooks, `API_SPECIFICATION.md` §23):
  every triggering domain event (`booking.confirmed`,
  `booking.cancelled`, `availability.updated`, `payout.processed`)
  publishes to the `webhooks` queue (Chapter 35); a dedicated delivery
  worker signs the payload (HMAC-SHA256, per-partner secret) and
  delivers it, retrying on non-2xx with exponential backoff up to a
  bounded 24-hour window before marking the delivery permanently failed
  and surfacing it in the Partner Dashboard's webhook log
  (`API_SPECIFICATION.md` §23's documented behavior) — never retried
  indefinitely.
- Both directions log every attempt (success, failure, retry) for
  operational visibility (Chapter 51) and support diagnosis.

## 45. External Integrations

- Every third-party dependency (payment gateway, email provider, SMS
  provider, cloud storage, map/geocoding service if ever needed
  server-side, iCal/Google Calendar sync per
  `BOOKING_ENGINE_ARCHITECTURE.md` §6.2) is accessed exclusively through
  an `infrastructure/` adapter implementing a Domain-layer-defined port
  (Chapter 3) — no Application-layer Service ever imports a third-party
  SDK directly, which is what makes provider migration, multi-provider
  fallback, and provider-specific outage isolation all
  infrastructure-only changes.
- Every external call has an explicit timeout and a circuit-breaker
  policy (fail fast and surface `ExternalServiceError`, Chapter 24, once
  a provider's failure rate crosses a threshold, rather than letting
  every request queue up behind a degraded dependency) — protecting the
  platform's own availability from a third party's outage.
- The Calendar Engine's iCal import polling and Google Calendar sync
  (`BOOKING_ENGINE_ARCHITECTURE.md` §6.2) are implemented as scheduled
  jobs (Chapter 37) calling their respective external-integration
  adapters, writing results into `blackout_dates` through the standard
  `calendar` module Service — never bypassing that module's own
  validation/business rules just because the data originated externally.

## 46. Search Strategy

- Implements `BOOKING_ENGINE_ARCHITECTURE.md` §16.3 exactly: a dedicated,
  denormalized search index (OpenSearch/Elasticsearch-class engine),
  fed from `listings` and `availability_calendar` via change-data-capture
  (domain events published by the `listings`/`availability` modules,
  consumed asynchronously by a `search-indexing` queue worker, Chapter
  35) — MySQL remains the system of record; the search index is a
  read-optimized derivative, never authoritative.
- `GET /listings/search` (`API_SPECIFICATION.md` §14/§38) is served
  entirely from this index — full-text, geo-radius, and faceted
  filtering all execute against it, never against MySQL directly, which
  is what keeps `GET /listings` (the authoritative, always-fresh list
  endpoint) and `/search` (the fast, eventually-consistent one)
  architecturally distinct, exactly as `API_SPECIFICATION.md` §14
  requires.
- Index lag is monitored (Chapter 52) and alerted on if it exceeds a
  documented threshold (a few seconds under normal load) — since every
  downstream consumer of search results (`FRONTEND_ARCHITECTURE.md`
  §19.3) already treats them as advisory-only, a brief lag is an
  accepted tradeoff, but an unbounded, silently-growing lag is an
  operational incident.


---

# PART IX — SECURITY AND OPERATIONS

## 47. Security

- **JWT** — signature-verified statelessly (Chapter 12), short-lived
  access tokens, rotated single-use refresh tokens with reuse detection.
- **RBAC/Permissions** — enforced at the guard-middleware layer (Chapter
  13–16) on every non-public route, never left to Controller-level
  discretion.
- **Input validation** — the Chapter 25 pipeline is mandatory on every
  mutating endpoint; a route with no Validator is a code-review-blocking
  defect, not an oversight to fix later.
- **SQL injection prevention** — all database access goes through
  parameterized queries via the Repository layer (Chapter 7)'s query
  builder/driver; string-concatenated SQL is banned platform-wide and
  caught by static analysis (Chapter 55's tooling) in addition to review.
- **XSS prevention** — the API never reflects unescaped user input into
  an HTML-rendering context itself (it returns JSON; escaping for
  display is `FRONTEND_ARCHITECTURE.md` §34.2's responsibility), but
  user-generated text (reviews, messages, CMS rich text) is still
  sanitized server-side at write time as defense-in-depth against any
  future rendering context that might not escape correctly.
- **CSRF** — mitigated primarily by the `SameSite=Strict` refresh-token
  cookie (Chapter 12) meaning the cookie is never attached to a
  cross-origin request; state-changing endpoints additionally require
  the `Authorization` bearer header (which a pure CSRF attack cannot
  forge), providing defense-in-depth beyond the cookie attribute alone.
- **Helmet** — standard security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, `Strict-Transport-Security`, a Content-Security-
  Policy compatible with `FRONTEND_ARCHITECTURE.md` §34.7's no-inline-
  style/script discipline) applied platform-wide via middleware (Chapter
  11), never per-route.
- **CORS** — an explicit origin allowlist (the platform's own web
  origins only; no wildcard `*` in production), configured centrally
  (Chapter 18), rejecting any other origin's cross-origin request by
  default.
- **Encryption** — TLS in transit everywhere (enforced at the load-
  balancer/ingress layer); sensitive-at-rest fields (nothing beyond what
  `DATABASE_ARCHITECTURE.md` already scopes as sensitive — the platform
  never stores raw payment card data at all, per Chapter 29) encrypted
  using envelope encryption with keys managed outside the application
  codebase.
- **Secrets/Environment** — Chapter 19's rules restated as a security
  control, not just an operational one: no secret in source control, no
  secret in a log line, no secret in an error response.

Full checklist cross-reference: Appendix B.

## 48. Rate Limiting

- Implements `API_SPECIFICATION.md` §17 exactly, enforced via Redis
  (Appendix A's `ratelimit:` keyspace) using a sliding-window algorithm:
  300 req/min (authenticated standard), 20 req/min (unauthenticated
  public search), 10 req/min (login, password reset, coupon-redemption
  attempts) — each tier configured centrally (Chapter 18), not
  hardcoded per route.
- Enforced at middleware level (Chapter 11), before any Controller
  code — a rate-limited request never reaches business logic, minimizing
  its cost to the system precisely when the system is under the most
  pressure.
- Partner/Admin server-to-server access uses a separate, higher-
  throughput tier keyed by API key/principal rather than session,
  matching `API_SPECIFICATION.md` §17's documented distinction.

## 49. API Versioning

- Implements `API_SPECIFICATION.md` §3 exactly: URL path versioning
  (`/api/v1`), a new major version created only for breaking changes and
  served side-by-side with the previous version for a minimum 12-month
  deprecation window, with `Deprecation`/`Sunset` response headers
  attached automatically via middleware once a version enters
  deprecation — the backend's routing layer (`module.routes.js` per
  module, Chapter 2) is versioned by directory (`v1/`, eventually `v2/`),
  never by runtime feature-flagging a single route tree, keeping the two
  versions' behavior fully independent and easy to reason about.

## 50. Health Checks

- **Liveness** (`/health/live`) — confirms the process itself is
  responsive; used by orchestration to decide whether to restart an
  instance.
- **Readiness** (`/health/ready`) — confirms the instance's dependencies
  (MySQL connection pool, Redis connection) are actually reachable; used
  by orchestration/load-balancing to decide whether to route traffic to
  this instance — an instance failing readiness is removed from rotation
  without being restarted, distinguishing a transient dependency blip
  from a genuinely crashed process.
- Both are unauthenticated, extremely lightweight, and never touch
  business logic or the queue system directly (checking BullMQ/Redis
  connectivity is sufficient; a health check never processes a real
  job).

## 51. Monitoring

- Every request's `request_id` (Chapter 11), latency, status code, and
  route is emitted as a structured log line (Chapter 20) and as a metric
  (Chapter 52) — the two are correlated so an alert on elevated error
  rate can be traced back to specific log lines via shared `request_id`s.
- Dead-lettered jobs (Chapter 36), webhook delivery failures (Chapter
  44), and search-index lag (Chapter 46) are all explicitly monitored
  with alerting thresholds — the platform's operational health dashboard
  surfaces these alongside standard infrastructure metrics (CPU, memory,
  connection pool saturation).

## 52. Metrics

- Standard categories exported to the metrics pipeline: request rate/
  latency/error-rate per route (RED metrics), queue depth and processing
  latency per queue (Chapter 35), database connection pool utilization,
  cache hit/miss ratio (Chapter 39), and the booking-funnel milestones
  already defined in `BOOKING_ENGINE_ARCHITECTURE.md` §14.6 (search →
  hold → payment → confirmed) — the backend emits these as counters/
  histograms at each corresponding Service-layer transition, feeding both
  Chapter 62-equivalent business analytics (`API_SPECIFICATION.md` §62)
  and pure infrastructure observability from the same underlying events.

## 53. OpenTelemetry Readiness

- Every inbound request and every outbound call (database, Redis,
  external provider) is instrumented with OpenTelemetry-compatible
  tracing spans from day one, even before a specific tracing backend is
  provisioned — the `request_id` (Chapter 11) is propagated as (and is
  compatible with) a trace ID, so adopting a full distributed-tracing
  backend later is a configuration/exporter change, never an
  instrumentation rewrite. This is what makes a future microservice
  extraction (`DATABASE_ARCHITECTURE.md` §15.4,
  `BOOKING_ENGINE_ARCHITECTURE.md` §16.4 — Booking/Payments as the first
  candidate) traceable end-to-end from the moment it happens.


---

# PART X — TESTING AND DELIVERY

## 54. Testing Strategy

A four-layer testing pyramid, enabled directly by Chapter 3's Clean
Architecture layering and Chapter 17's dependency injection:

| Layer | Tool | Scope |
|---|---|---|
| Unit | Jest | Domain/Application logic in isolation (Chapter 55) |
| Integration | Jest + Supertest | Real MySQL/Redis against a module's full stack (Chapter 56) |
| Contract | Jest + OpenAPI validator | Every endpoint's actual request/response against `API_SPECIFICATION.md`'s published bundle (Chapter 57) |
| End-to-end | (owned jointly with `FRONTEND_ARCHITECTURE.md` §35's Playwright suite) | Full user journeys across the real API |

## 55. Unit Tests

- Target: Domain entities/rules (a `ReservationHold`'s expiry logic, a
  `CancellationPolicy`'s resolution algorithm, every Pricing calculator
  in the chain, Chapter 28) and Application-layer Services, using
  hand-written fakes for their Repository/port dependencies (Chapter 17)
  — **no real MySQL, Redis, or external SDK** in this layer; a unit test
  suite runs in milliseconds and is the primary tool for exercising every
  branch of `BOOKING_ENGINE_ARCHITECTURE.md`'s state machine and
  algorithms exhaustively, including edge cases (a cancellation exactly
  at a policy tier boundary, a hold expiring in the same millisecond a
  confirm request arrives) that would be slow or flaky to construct
  against a real database.
- Static analysis (linting, the same SQL-injection/string-concatenation
  ban from Chapter 47) runs alongside unit tests in CI, blocking merge on
  failure.

## 56. Integration Tests

- Target: Repository implementations against a real, ephemeral test
  MySQL instance (verifying the actual query/transaction behavior
  Chapter 40's rules describe), Redis-backed locking/caching/rate-
  limiting behavior (Chapters 39/42/48) against a real Redis instance,
  and full request-to-response Controller behavior via Supertest against
  an in-process Express app with real infrastructure but test/sandboxed
  external providers (a payment gateway sandbox, a mocked email/SMS
  provider).
- **Required scenarios** (mirroring `FRONTEND_ARCHITECTURE.md` §35.1's
  list, verified from the backend's side): concurrent hold-creation race
  resolution (Chapter 42's worked-example guarantee, executed as an
  actual concurrent-request test, not just asserted in isolation),
  idempotency-key replay producing an identical response, hold expiration
  sweep correctly releasing calendar rows, webhook signature verification
  rejecting a tampered payload, refresh-token rotation and reuse
  detection, and every module's ownership/permission guard rejecting an
  out-of-scope request.

## 57. Contract Tests

- Every endpoint's actual, running implementation is validated against
  the published OpenAPI bundle (`API_SPECIFICATION.md` §26) in CI —
  request schema, response schema, status codes, and error shapes must
  match exactly; a mismatch fails the build regardless of whether the
  "wrong" side is the implementation or a stale spec, forcing the two
  to be reconciled before merge.
- This is also where `FRONTEND_ARCHITECTURE.md` §35's own contract-test
  layer and this backend's contract tests meet: both are validated
  against the **same** OpenAPI bundle, which is what guarantees the
  frontend's generated types (`FRONTEND_ARCHITECTURE.md` §26 reference)
  and the backend's actual responses can never silently diverge.

## 58. Deployment Strategy

- **Containerized, stateless application instances** (Chapter 12/59) behind
  a load balancer — any instance can serve any request; no instance
  holds session-critical state that isn't in MySQL/Redis.
- **CI/CD pipeline per merge to main:** lint → unit tests (Chapter 55) →
  integration tests (Chapter 56) → contract tests (Chapter 57) → build
  container image → deploy to staging → smoke tests → manual/automatic
  promotion to production via a blue-green or rolling deployment
  strategy, never in-place mutation of running instances.
- **Database migrations** run as a distinct, ordered pipeline step
  **before** new application code is rolled out, following
  `DATABASE_ARCHITECTURE.md` §15.5's expand-and-contract discipline
  (additive migrations deploy ahead of the code that uses them;
  destructive migrations follow only after all code depending on the old
  shape is fully retired) — a deployment is never allowed to run new
  application code against an unmigrated database.
- **Rollback** is always "redeploy the previous container image," never
  a manual code-level hotfix against a live instance, mirroring
  `FRONTEND_ARCHITECTURE.md` §38's identical rollback discipline on the
  frontend.

## 59. Scalability

- **Horizontal scaling of the application tier** is the default scaling
  strategy (add more stateless instances behind the load balancer), not
  vertical scaling of a single instance — enabled directly by Chapter
  12's stateless-JWT authentication and Chapter 38's Redis-based shared
  coordination (locks, rate limits, sessions) rather than any
  in-process state.
- **Database scaling** follows `DATABASE_ARCHITECTURE.md` §15 exactly:
  read replicas for catalog/search-adjacent read traffic, RANGE
  partitioning by `created_at` on high-volume tables (`bookings`,
  `payments`, `availability_calendar`, `notifications`), and archival of
  data outside the active reporting window — all transparent to the
  Repository layer (Chapter 7), which is written against a logical
  "the database" interface regardless of how many physical replicas or
  partitions sit behind it.
- **Queue scaling:** BullMQ worker concurrency (Chapter 36) is
  independently horizontally scalable per queue — a spike in
  media-processing volume is absorbed by adding workers to that queue
  alone, without affecting the hold-expiration sweep's own dedicated,
  latency-sensitive worker pool.
- **Microservices-ready boundaries** (restated from
  `DATABASE_ARCHITECTURE.md` §15.4 and
  `BOOKING_ENGINE_ARCHITECTURE.md` §16.4): because every module (Part XI)
  is already a Clean-Architecture vertical slice with a narrow, explicit
  public Service interface (Chapter 4) and cross-module calls only ever
  go through that interface, extracting `bookings`/`payments` into an
  independently deployed service later is a matter of moving that
  module's code behind a network boundary and replacing its in-process
  Service calls with remote calls — the module's internal structure
  (Controllers, Services, Repositories) does not need to change shape to
  make that move.

## 60. Definition of Done

A backend change is **not done** until every one of the following is
true:

- [ ] Matches `API_SPECIFICATION.md`'s documented contract for every
      endpoint touched — verified by Chapter 57's contract tests, not
      just manual review.
- [ ] Never contradicts a `BOOKING_ENGINE_ARCHITECTURE.md` state
      transition, algorithm, or business rule.
- [ ] Respects Clean Architecture's Dependency Rule (Chapter 3) — no
      inner-layer import of an outer-layer concern, verified by the
      module dependency-direction lint rule.
- [ ] Every mutating endpoint has Layer 2 validation (Chapter 10/25) and,
      where business rules require it, Layer 3 transactional validation.
- [ ] Every contended-resource write is protected by the correct
      combination of transaction boundary (Chapter 40), locking strategy
      (Chapters 41–42), and idempotency (Chapter 43) — never left to
      "it probably won't race in practice."
- [ ] Every new/changed exception is a named class in the Exception
      Hierarchy (Chapter 24) with a mapped Appendix A code — never a raw
      thrown string or generic `Error`.
- [ ] Every privileged/state-changing action writes its required Audit
      Log entry (Chapter 21) within the same transaction as the change.
- [ ] Every asynchronous side effect (notification, search-index update,
      webhook) is queued (Chapter 35), never inline in the request path.
- [ ] No secret, token, or PII is logged in plaintext (Chapter 20, 47).
- [ ] Covered by unit tests for all new Domain/Application logic and
      integration tests for the required scenarios (Chapters 55–56),
      including the specific concurrency/idempotency scenarios this
      change introduces or touches.
- [ ] Passes the full CI pipeline (Chapter 58): lint, unit, integration,
      contract tests, and a successful staging smoke test.
- [ ] Reviewed and approved by the owning module's team (Part XI) and, for
      any change to `core/`, `infrastructure/`, `middleware/`, or a
      cross-module public Service interface, by the platform/
      architecture sub-team.


---

# PART XI — MODULE CATALOG

> Format: **Purpose** · **Responsibilities** · **Public Services** ·
> **Internal Services** · **Dependencies** (other modules) ·
> **Database Tables** (`DATABASE_ARCHITECTURE.md`) · **Events** (published
> domain events) · **Queue Jobs** · **Transactions** (key boundaries) ·
> **Caching Rules** · **Error Strategy** · **Validation Strategy**.

## 1. Core

**Purpose:** Not a business module — the shared kernel (Chapters 2–3):
Domain value objects (`Money`, date ranges), the Exception Hierarchy
(Ch. 24), the AuditLogger (Ch. 21), the DI container root (Ch. 17), and
port interfaces every module's Repositories/Services implement against.
**Responsibilities:** Own zero business rules of its own; provide the
scaffolding every other module builds on. **Public Services:**
`AuditLogger`, `EventBus` (in-process domain event publish/subscribe,
consumed by queue producers), shared value-object constructors.
**Internal Services:** None (everything here is public by definition).
**Dependencies:** None — every other module depends on `Core`, never the
reverse. **Database Tables:** `audit_logs`, `activity_logs`,
`system_settings`, `feature_flags`. **Events:** N/A (transport, not
producer). **Queue Jobs:** N/A. **Transactions:** N/A (delegates to
callers). **Caching Rules:** `system_settings`/`feature_flags` cached
with event-driven invalidation (Ch. 39). **Error Strategy:** Owns the
Exception Hierarchy definition (Ch. 24) all modules throw from.
**Validation Strategy:** Owns the shared Validator/DTO base plumbing
(Ch. 9–10) all modules extend.

## 2. Auth

**Purpose:** Authentication and session lifecycle
(`API_SPECIFICATION.md` §27). **Responsibilities:** Registration, login,
JWT issuance, refresh rotation, logout, password reset, email/phone
verification. **Public Services:** `AuthenticationService`,
`TokenService`, `PasswordResetService`. **Internal Services:**
`LoginAttemptTracker`, `RefreshTokenStore`. **Dependencies:** `Users`
(for account lookup), `Notifications` (verification/reset emails).
**Database Tables:** `users` (auth fields), `login_history`.
**Events:** `user.registered`, `user.logged_in`, `user.password_reset`.
**Queue Jobs:** verification-email send, password-reset-email send.
**Transactions:** registration (create `users` row + initial
verification token, one transaction). **Caching Rules:** login-attempt
counters in Redis (Ch. 12); refresh tokens never cached, always a direct
lookup. **Error Strategy:** `AuthenticationError` subtypes
(`INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `AUTH_TOKEN_REUSE_DETECTED`).
**Validation Strategy:** strict password-strength and email-format
Validators (Layer 2); uniqueness check is Layer 3 (requires a
`Users` lookup).

## 3. Users

**Purpose:** Core account records (`API_SPECIFICATION.md` §28–29).
**Responsibilities:** Profile CRUD, account suspension/deactivation,
address book. **Public Services:** `UserService`, `ProfileService`.
**Internal Services:** `AddressService`. **Dependencies:** `Auth`
(revokes tokens on suspend), `Notifications`. **Database Tables:**
`users`, `user_profiles`, `addresses`. **Events:** `user.suspended`,
`user.updated`. **Queue Jobs:** none owned directly (suspension
notification is queued via `Notifications`). **Transactions:**
suspend-account (status update + refresh-token revocation, one
transaction). **Caching Rules:** public profile fields cached briefly
(Ch. 39); full account record never cached. **Error Strategy:**
`NotFoundError`, `AuthorizationError` (ownership). **Validation
Strategy:** Layer 2 for field formats; Layer 3 for
email/phone-already-registered checks on change.

## 4. Organizations

**Purpose:** Partner account/billing view (`API_SPECIFICATION.md` §31)
over the same `partners` entity `Partners` (Module 5) exposes publicly.
**Responsibilities:** Billing/payout settings, read-only commission-plan
visibility. **Public Services:** `OrganizationService`. **Internal
Services:** none. **Dependencies:** `Partners` (shares the same
aggregate), `Payouts`. **Database Tables:** `partners` (billing
columns). **Events:** `organization.billing_updated`. **Queue Jobs:**
none. **Transactions:** billing-detail update (single-row). **Caching
Rules:** not cached (low-traffic, correctness-sensitive financial
settings). **Error Strategy:** `AuthorizationError` (partner_owner only,
Ch. 15). **Validation Strategy:** Layer 2 for billing-field formats.

## 5. Partners

**Purpose:** Partner business-entity lifecycle
(`API_SPECIFICATION.md` §30). **Responsibilities:** Application intake,
verification workflow, public profile, outbound webhook registration.
**Public Services:** `PartnerService`, `PartnerWebhookService`.
**Internal Services:** `PartnerVerificationService`. **Dependencies:**
`Users` (applicant), `Listings` (partner's listings), `Admin`
(verification approval). **Database Tables:** `partners`.
**Events:** `partner.applied`, `partner.verified`. **Queue Jobs:**
verification-decision notification. **Transactions:** verify-partner
(status transition + audit log, one transaction, Ch. 21).
**Caching Rules:** public partner profile cached briefly; verification
status never cached. **Error Strategy:** `PARTNER_NOT_VERIFIED`
(`ConflictError`). **Validation Strategy:** Layer 3 gates listing
creation on verified status (`Listings` module calls `PartnerService`
to check).

## 6. Employees

**Purpose:** Partner staff and scoped roles
(`API_SPECIFICATION.md` §32, `BACKEND_ARCHITECTURE.md` Ch. 15).
**Responsibilities:** Invite, role assignment, removal, last-owner
protection. **Public Services:** `PartnerEmployeeService`. **Internal
Services:** none. **Dependencies:** `Partners`, `Auth` (invite triggers
registration if needed), `RBAC` (Ch. 14, shared). **Database Tables:**
`partner_employees`. **Events:** `employee.invited`,
`employee.removed`. **Queue Jobs:** invitation email.
**Transactions:** role change (single-row, but re-validated against
last-owner rule inside the same transaction to prevent a race removing
two owners simultaneously). **Caching Rules:** none (low volume,
correctness-critical). **Error Strategy:**
`LAST_OWNER_CANNOT_BE_REMOVED` (`ConflictError`). **Validation
Strategy:** Layer 3 last-owner count check.

## 7. Listings

**Purpose:** The shared catalog parent every bookable module extends
(`API_SPECIFICATION.md` §38, `BOOKING_ENGINE_ARCHITECTURE.md` §1.1).
**Responsibilities:** Listing CRUD, translations, categories, amenities,
media attachment, publish-readiness gating. **Public Services:**
`ListingService`, `ListingMediaService`. **Internal Services:**
`PublishReadinessChecker`. **Dependencies:** `Partners` (ownership,
verification gate), `Media`, `Availability` (bookable-unit existence
check at publish time), one module per listing type (Modules 8–14,
composed via `type_specific` dispatch). **Database Tables:** `listings`,
`listing_translations`, `listing_categories`,
`listing_category_listing`, `listing_amenities`,
`listing_amenity_listing`, `listing_locations`. **Events:**
`listing.created`, `listing.published`, `listing.updated`,
`listing.deleted` (consumed by `Availability`'s search-indexing queue,
Ch. 46). **Queue Jobs:** search-index update (triggered by events, not
owned as a scheduled job). **Transactions:** publish (readiness check +
status update, one transaction). **Caching Rules:** listing detail
cached short-TTL (Ch. 39), invalidated on `listing.updated`.
**Error Strategy:** `UNKNOWN_LISTING_TYPE`,
`INVALID_TYPE_SPECIFIC_FIELDS` (`ValidationError`). **Validation
Strategy:** Layer 2 validates core fields; `type_specific` payload
delegated to the owning module-type's own Validator (composed, not
duplicated).

## 8–14. Hotels · Vacation Houses · Restaurants · SPA · Cars · Tours · Events

These seven modules share one structural template — each is a thin
extension of `Listings` (Module 7) plus its own inventory sub-resource —
per `BOOKING_ENGINE_ARCHITECTURE.md` Appendix A. Documented once;
differences noted per module.

**Purpose:** Module-specific attributes and inventory management for one
`listing_type`. **Responsibilities:** Extension-attribute CRUD;
creating/retiring the module's inventory sub-resource, which is what
creates/retires the corresponding `bookable_units` row. **Public
Services:** `{Module}Service` (extension attributes),
`{Module}InventoryService` (room types/rooms, tables, services,
vehicles, departures, sessions). **Internal Services:** none typically.
**Dependencies:** `Listings` (parent), `Availability` (registers/
retires `bookable_units`). **Database Tables:** `hotels` +
`hotel_room_types` + `hotel_rooms`; `vacation_houses`; `restaurants` +
`restaurant_tables`; `spas` + `spa_services`; `car_rentals` +
`vehicle_categories`; `tours` + `tour_departures`; `events` +
`event_sessions` (per `DATABASE_ARCHITECTURE.md` §4.4).
**Events:** `{module}.inventory_created`, `{module}.inventory_retired`
(consumed by `Availability`). **Queue Jobs:** none owned directly.
**Transactions:** inventory creation (extension-row + `bookable_units`
row, one transaction, since the two must never exist independently).
**Caching Rules:** extension-attribute detail cached alongside its
parent listing (Ch. 39). **Error Strategy:** standard `ValidationError`/
`NotFoundError`; Tours/Events additionally throw `ConflictError`
(`LATE_CHECKOUT_CONFLICT`-class) when retiring a departure/session with
existing confirmed bookings, triggering the Cancellation Engine's
partner-initiated path (`BOOKING_ENGINE_ARCHITECTURE.md` §9.5) rather
than a bare delete. **Validation Strategy:** Layer 2 for attribute
formats (e.g., `duration_minutes`, `seats_available` bounds); Layer 3
for capacity-consistency checks against `max_group_size`/`max_occupancy`.

## 15. Availability

**Purpose:** The four availability algorithms and the authoritative
real-time check (`BOOKING_ENGINE_ARCHITECTURE.md` §4). **Responsibilities:**
`bookable_units` lifecycle, `availability_calendar` read/write, blackout
enforcement, algorithm selection per unit. **Public Services:**
`AvailabilityCheckService`, `BookableUnitService`,
`BlackoutService`. **Internal Services:** four `AvailabilityStrategy`
implementations (Ch. 27). **Dependencies:** `Listings` (unit ownership),
consumed by `BookingHolds`. **Database Tables:** `bookable_units`,
`availability_calendar`, `reservation_holds` (read-only from this
module's perspective — owned by `BookingHolds`), `blackout_dates`.
**Events:** `availability.updated` (feeds search indexing, Ch. 46).
**Queue Jobs:** none owned directly (the hold-expiration sweep, Part
XII, lives in `BookingHolds`, though it writes back to this module's
tables). **Transactions:** every availability-check-plus-hold-write is
one transaction spanning this module's tables and `BookingHolds`'
(Ch. 26/40). **Caching Rules:** **never cached** (Ch. 39's hard rule).
**Error Strategy:** `AVAILABILITY_CONFLICT`, `BLACKOUT_DATE`
(`ConflictError`/`ValidationError`). **Validation Strategy:** Layer 3
only — availability cannot be validated from a request payload alone;
it always requires a live table read under lock (Ch. 42).

## 16. Pricing

**Purpose:** The full pricing pipeline
(`BOOKING_ENGINE_ARCHITECTURE.md` §7, Ch. 28). **Responsibilities:**
Rate plans, seasonal/holiday/special pricing, dynamic pricing, tax/
commission resolution, price-quote generation. **Public Services:**
`PriceResolutionService`, `RatePlanService`. **Internal Services:** the
ordered chain of calculator objects (Ch. 28). **Dependencies:**
`Listings`, `Coupons` (discount stage), consumed by `BookingHolds`.
**Database Tables:** `rate_plans`, `rate_plan_prices`, `price_rules`,
`taxes`, `tax_rules`, `commission_plans`, `commission_rules`,
`discounts`. **Events:** `pricing.rate_plan_updated`. **Queue Jobs:**
dynamic-pricing recalculation (scheduled, Part XII). **Transactions:**
rate-plan/price-rule writes are single-aggregate transactions; pricing
**reads** (quote generation) are never transactional writes themselves.
**Caching Rules:** a resolved quote is never cached as authoritative
(Ch. 39); the underlying rate-plan/tax reference data may be
short-TTL cached. **Error Strategy:** `ValidationError` for malformed
rate rules. **Validation Strategy:** Layer 3 enforces
`BOOKING_ENGINE_ARCHITECTURE.md` §9.7's Custom-policy structural
constraints at write time (chronological tiers, non-increasing
percentages).

## 17. Booking Holds

**Purpose:** The reservation-hold lifecycle
(`BOOKING_ENGINE_ARCHITECTURE.md` §5, Ch. 26). **Responsibilities:**
Hold creation (locked, transactional), confirmation (the platform's most
critical transaction), expiration, release. **Public Services:**
`ReservationHoldService`. **Internal Services:**
`DistributedLockManager` client (Ch. 42), `ConfirmBookingHoldUseCase`
(Ch. 26). **Dependencies:** `Availability`, `Pricing`, `Payments`,
`Bookings` (the hold confirms *into* a booking), `Notifications`.
**Database Tables:** `reservation_holds` (owned), writes to
`availability_calendar`, `booking_items`, `bookings`, `invoices`,
`invoice_items` at confirmation. **Events:** `hold.created`,
`hold.confirmed`, `hold.expired`, `hold.released`. **Queue Jobs:**
hold-expiration sweep (Part XII). **Transactions:** create-hold (lock +
availability re-check + insert, Ch. 5.5); confirm-hold (the full
multi-table transaction, Ch. 26). **Caching Rules:** never cached; every
read is authoritative (Ch. 14.6 of `FRONTEND_ARCHITECTURE.md` depends on
this). **Error Strategy:** `HOLD_EXPIRED`, `AVAILABILITY_CONFLICT`,
`HOLD_LIMIT_EXCEEDED` (`ConflictError`/`RateLimitError`). **Validation
Strategy:** Layer 3 exclusively for availability/capacity; Layer 2 for
request shape (unit IDs, date/slot format).

## 18. Bookings

**Purpose:** The booking status machine
(`BOOKING_ENGINE_ARCHITECTURE.md` §3, §12–13). **Responsibilities:**
Status transitions post-confirmation (check-in, check-out, cancellation,
completion), guest details, status history. **Public Services:**
`BookingService`, `CheckInService`, `CheckOutService`,
`CancellationService`. **Internal Services:**
`CancellationPolicyResolver` (§9.2's algorithm). **Dependencies:**
`BookingHolds` (origin), `Payments`/`Refunds` (cancellation triggers
refund), `Notifications`, `Reviews` (eligibility check reads booking
status). **Database Tables:** `bookings`, `booking_items`,
`booking_guests`, `booking_status_history`. **Events:**
`booking.checked_in`, `booking.checked_out`, `booking.cancelled`,
`booking.completed`. **Queue Jobs:** scheduled auto-completion (Part
XII). **Transactions:** every status transition writes the status
field, a `booking_status_history` row, and (where applicable) an
`audit_logs` row in one transaction (Ch. 21). **Caching Rules:** short-
TTL list cache for "My Trips"-style views (Ch. 39); detail view not
cached given status-sensitivity. **Error Strategy:**
`BOOKING_NOT_CANCELLABLE`, `TOO_EARLY_FOR_CHECK_IN`,
`LATE_CHECKOUT_CONFLICT` (`ConflictError`). **Validation Strategy:**
Layer 3 state-machine legality check (Ch. 24's `ConflictError` for any
attempted illegal transition) on every mutation.

## 19. Payments

**Purpose:** Payment authorization/capture and gateway integration
(`BOOKING_ENGINE_ARCHITECTURE.md` §8, Ch. 29). **Responsibilities:**
Authorize/capture orchestration, saved payment methods, gateway webhook
processing. **Public Services:** `PaymentService`,
`PaymentMethodService`. **Internal Services:** `PaymentGatewayAdapter`
client. **Dependencies:** `BookingHolds`/`Bookings` (triggering
context), `Wallet` (Ch. 8.3). **Database Tables:** `payments`,
`payment_methods`, `payment_transactions`. **Events:**
`payment.authorized`, `payment.captured`, `payment.failed`,
`payment.chargeback`. **Queue Jobs:** failed-payment retry (Part XII).
**Transactions:** capture-confirmation write (payment status +
`payment_transactions` append, one transaction) — always *after* the
external gateway call returns, never wrapping the call itself (Ch. 40).
**Caching Rules:** never cached. **Error Strategy:** `PAYMENT_FAILED`
(`ExternalServiceError`/domain-specific subtype). **Validation
Strategy:** Layer 2 for payment-method-reference shape; the actual
charge outcome is always Layer 3 (gateway-determined, not
client-predictable).

## 20. Refunds

**Purpose:** Refund execution (`BOOKING_ENGINE_ARCHITECTURE.md` §8.5,
§9). **Responsibilities:** Automatic refunds from cancellation
decisions, manual/goodwill refunds. **Public Services:**
`RefundService`. **Internal Services:** none. **Dependencies:**
`Payments` (executes against), `Bookings` (cancellation trigger),
`Admin` (manual refund permission). **Database Tables:** `refunds`.
**Events:** `refund.issued`. **Queue Jobs:** refund processing
(asynchronous against the gateway, Part XII pattern). **Transactions:**
refund-record write, separate from but referencing the original payment
transaction. **Caching Rules:** none. **Error Strategy:**
`ValidationError` (manual refund requires `reason_code`).
**Validation Strategy:** Layer 3 — a refund amount is always
server-computed (Ch. 20.2 of `FRONTEND_ARCHITECTURE.md` restates this
from the client's side); manual refunds require `refund.issue`
permission (Ch. 16).

## 21. Wallet

**Purpose:** Platform credit balance (`API_SPECIFICATION.md` §60,
`BOOKING_ENGINE_ARCHITECTURE.md` §8.3). **Responsibilities:** Balance
tracking, credit (from refunds/promotions), debit (at hold confirmation).
**Public Services:** `WalletService`. **Internal Services:** none.
**Dependencies:** `Refunds` (credit source), `BookingHolds` (debit
consumer). **Database Tables:** derives balance from `payments`/
`refunds` rows tagged wallet-type (per `DATABASE_ARCHITECTURE.md` §4.8's
`payment_methods` wallet type). **Events:** `wallet.credited`,
`wallet.debited`. **Queue Jobs:** wallet settlement reconciliation (Part
XII). **Transactions:** debit-at-confirmation happens inside the same
transaction as Ch. 17's confirm-hold transaction — a wallet debit is
never a separate, independently-committed step. **Caching Rules:**
balance cached very short-TTL for display, always re-verified
authoritatively at debit time. **Error Strategy:** `ConflictError` for
insufficient balance. **Validation Strategy:** Layer 3 balance
sufficiency check under the same lock as the confirm transaction.

## 22. Payouts

**Purpose:** Partner settlement batching
(`BOOKING_ENGINE_ARCHITECTURE.md` §8.6). **Responsibilities:** Scheduled
batch aggregation, commission/refund/chargeback netting, manual
out-of-cycle trigger. **Public Services:** `PayoutService`. **Internal
Services:** `PayoutBatchCalculator`. **Dependencies:** `Bookings`
(Completed bookings source), `Pricing` (commission rules), `Refunds`/
`Payments` (chargeback netting). **Database Tables:** `payouts`.
**Events:** `payout.processed`. **Queue Jobs:** payout-processing batch
(Part XII, scheduled). **Transactions:** one transaction per payout
batch, computing and writing the full batch atomically. **Caching
Rules:** none (financial record, always read fresh). **Error Strategy:**
`ExternalServiceError` if the payout-disbursement provider call fails
(batch marked partially-failed, retried, never silently dropped).
**Validation Strategy:** Layer 3 — batch calculation is inherently a
server-side aggregation, not something to validate against client input.

## 23. Coupons

**Purpose:** Promotional codes (`API_SPECIFICATION.md` §52,
`BOOKING_ENGINE_ARCHITECTURE.md` §7.5). **Responsibilities:** Coupon
CRUD, validation, redemption tracking. **Public Services:**
`CouponService`. **Internal Services:** none. **Dependencies:**
`Pricing` (discount-stage consumer), `BookingHolds` (redemption trigger
at confirm). **Database Tables:** `coupons`, `coupon_redemptions`.
**Events:** `coupon.redeemed`. **Queue Jobs:** none. **Transactions:**
redemption write happens inside the confirm-hold transaction (Ch. 17),
never as a separate step that could apply a discount without a
corresponding successful booking. **Caching Rules:** coupon-code lookup
cached short-TTL (Ch. 39), always re-validated (usage limits) at
redemption time regardless of cache. **Error Strategy:**
`COUPON_INVALID` (`ValidationError`). **Validation Strategy:** Layer 3
usage-limit/expiry/per-user-limit checks, re-verified under lock at
redemption to prevent a race exceeding `usage_limit`.

## 24. Favorites

**Purpose:** Saved listings (`API_SPECIFICATION.md` §53).
**Responsibilities:** Add/remove/list. **Public Services:**
`FavoriteService`. **Internal Services:** none. **Dependencies:**
`Listings`. **Database Tables:** `favorites`. **Events:** none
(low-stakes; no downstream consumer needs to react). **Queue Jobs:**
none. **Transactions:** single-row insert/delete. **Caching Rules:**
list cached short-TTL per user. **Error Strategy:** `ALREADY_FAVORITED`
(`ConflictError`, from the composite unique constraint). **Validation
Strategy:** Layer 2 only (favorable type/ID shape).

## 25. Reviews

**Purpose:** Post-stay reviews (`API_SPECIFICATION.md` §54).
**Responsibilities:** Submission eligibility, reply, moderation.
**Public Services:** `ReviewService`. **Internal Services:**
`ReviewEligibilityChecker`. **Dependencies:** `Bookings` (Completed-
status eligibility check), `Listings` (aggregate rating). **Database
Tables:** `reviews`, `review_replies`. **Events:** `review.submitted`
(triggers listing aggregate-rating recompute), `review.moderated`.
**Queue Jobs:** review-request reminder (Part XII). **Transactions:**
review write (single-row, but eligibility check reads `Bookings` first,
outside the write transaction, since it's a different aggregate).
**Caching Rules:** listing aggregate rating cached, invalidated on
`review.submitted`/`review.moderated`. **Error Strategy:**
`NOT_ELIGIBLE_TO_REVIEW`, `ALREADY_REVIEWED` (`ConflictError`).
**Validation Strategy:** Layer 3 — eligibility inherently requires a
`Bookings` lookup.

## 26. Messaging

**Purpose:** Guest↔partner conversations (`API_SPECIFICATION.md` §56).
**Responsibilities:** Conversation/message CRUD, participant membership
enforcement. **Public Services:** `MessagingService`. **Internal
Services:** none. **Dependencies:** `Notifications` (new-message alert).
**Database Tables:** `conversations`, `conversation_participants`,
`messages`. **Events:** `message.sent`. **Queue Jobs:** none (real-time
delivery is Socket.IO-ready, Ch. 45's future-integration note — today,
notification-based). **Transactions:** message insert + conversation
`updated_at` touch, one transaction. **Caching Rules:** conversation
list cached short-TTL per user. **Error Strategy:** `AuthorizationError`
for non-participants. **Validation Strategy:** Layer 3 participant-
membership check on every read/write.

## 27. Notifications

**Purpose:** The unified notification dispatch layer
(`BOOKING_ENGINE_ARCHITECTURE.md` §10, Ch. 32). **Responsibilities:**
Durable in-app record, channel preference resolution, template
rendering, dispatch orchestration to Email/SMS/Push. **Public
Services:** `NotificationService` (called by every other module).
**Internal Services:** `TemplateRenderer`, `ChannelPreferenceResolver`.
**Dependencies:** `Email` (infrastructure adapter, Ch. 33), `SMS`
(Ch. 34) — every business module depends on this module; this module
depends on none of them. **Database Tables:** `notifications`,
`notification_templates`, `notification_preferences`. **Events:**
consumes events from every other module (Ch. 32); does not itself
publish domain events other modules react to. **Queue Jobs:**
per-channel dispatch queues (email, SMS, push). **Transactions:** the
durable `notifications` row write is always synchronous within the
triggering module's own transaction (per
`BOOKING_ENGINE_ARCHITECTURE.md` §10.1's decoupling — only *external*
delivery is queued, not the durable record itself). **Caching Rules:**
unread count cached very short-TTL, invalidated on read/new-notification
events. **Error Strategy:** delivery failures are logged and retried
(Ch. 36), never surfaced as a failure of the triggering action.
**Validation Strategy:** Layer 2 for preference-update requests.

## 28. CMS

**Purpose:** Static/marketing content (`API_SPECIFICATION.md` §63).
**Responsibilities:** Page CRUD, translations, publish status.
**Public Services:** `CmsPageService`. **Internal Services:** none.
**Dependencies:** none. **Database Tables:** `cms_pages`,
`cms_page_translations`. **Events:** `cms_page.published`. **Queue
Jobs:** none. **Transactions:** single-aggregate writes. **Caching
Rules:** published pages cached aggressively (long TTL, Ch. 39),
invalidated on publish/update. **Error Strategy:** standard
`NotFoundError`/`ValidationError`. **Validation Strategy:** Layer 2 for
required-locale content completeness before publish.

## 29. Analytics

**Purpose:** Read-only aggregation (`API_SPECIFICATION.md` §62,
`BOOKING_ENGINE_ARCHITECTURE.md` §14). **Responsibilities:** Revenue,
occupancy, ADR/RevPAR, cancellation-rate, conversion-funnel queries.
**Public Services:** `AnalyticsService`. **Internal Services:** per-
metric calculators. **Dependencies:** reads from `Bookings`, `Payments`,
`Availability` — via their Repositories' read-only query methods, never
via a separate duplicated data store. **Database Tables:** reads
`invoice_items`, `availability_calendar`, `booking_status_history`
(no tables owned). **Events:** none. **Queue Jobs:** daily/weekly/
monthly aggregation pre-computation (Part XII, for expensive rollups
only — simple queries run live). **Transactions:** none (read-only).
**Caching Rules:** aggregated results cached (minutes-to-hours TTL
depending on metric) since analytics tolerates brief staleness unlike
booking-critical data. **Error Strategy:** standard. **Validation
Strategy:** Layer 2 for date-range/filter parameter bounds.

## 30. Admin

**Purpose:** Cross-cutting privileged operations
(`API_SPECIFICATION.md` §68, Ch. 16). **Responsibilities:**
Impersonation, commission-plan assignment, moderation queue, hard-delete
purge. **Public Services:** `AdminService`, `ImpersonationService`,
`ModerationService`. **Internal Services:** none. **Dependencies:**
composes nearly every module (Ch. 4's composition-module pattern — no
module depends back on `Admin`). **Database Tables:** reads/writes
across modules via their public Services, plus a dedicated compliance-
purge log (Ch. 16, separate from `audit_logs`). **Events:**
`admin.impersonation_started/ended`, `user.purged`. **Queue Jobs:**
none owned directly. **Transactions:** purge (Ch. 16's one sanctioned
hard-delete, executed as an irreversible, heavily-logged transaction).
**Caching Rules:** none (every admin action must reflect live state).
**Error Strategy:** the platform's strictest permission checks (Ch. 16).
**Validation Strategy:** Layer 3 for every cross-module action,
delegated to the target module's own business rules — `Admin` never
bypasses a module's own validation just because the caller is an admin.

## 31. Support

**Purpose:** Support ticketing (`API_SPECIFICATION.md` §65).
**Responsibilities:** Ticket CRUD, threaded replies, booking-context
linkage. **Public Services:** `SupportTicketService`. **Internal
Services:** none. **Dependencies:** `Bookings` (linked-ticket context),
`Notifications`. **Database Tables:** `support_tickets`,
`support_messages`. **Events:** `ticket.opened`, `ticket.closed`.
**Queue Jobs:** none. **Transactions:** ticket/message writes,
single-aggregate. **Caching Rules:** none (low volume, always-fresh
support context needed). **Error Strategy:** standard. **Validation
Strategy:** Layer 2 for ticket-creation fields.

## 32. Reports

**Purpose:** Asynchronous, downloadable exports
(`API_SPECIFICATION.md` §66). **Responsibilities:** Report-generation
job orchestration, file generation, download serving. **Public
Services:** `ReportService`. **Internal Services:**
`ReportGeneratorRegistry` (one generator per report type). **Dependencies:**
`Analytics` (data source), `Media`/storage (file output). **Database
Tables:** a `reports` job-tracking table (status, file reference).
**Events:** `report.ready`. **Queue Jobs:** report-generation (Part
XII). **Transactions:** status-update-to-ready (single-row).
**Caching Rules:** none (generated artifacts are stored files, not
cached query results). **Error Strategy:** `ExternalServiceError` if
storage write fails; job marked failed, visible to the requester.
**Validation Strategy:** Layer 2 for date-range/type parameters.

## 33. Media

**Purpose:** The upload/processing pipeline (Ch. 30–31).
**Responsibilities:** Upload-intent issuance, confirmation, variant
generation, polymorphic attachment to any entity. **Public Services:**
`MediaService`. **Internal Services:** `ImageProcessingService`,
`VideoProcessingService`. **Dependencies:** consumed by `Listings`,
`Reviews`, `Users`, `CMS` — depends on none of them (a leaf,
foundational module alongside `Notifications`). **Database Tables:**
`media`, `media_translations`. **Events:** `media.uploaded`,
`media.processed`. **Queue Jobs:** image/video processing (Part XII).
**Transactions:** confirmation-write (single-row, plus the storage-
existence check happens before the transaction opens, per Ch. 40's
external-call-outside-transaction rule). **Caching Rules:** media
metadata cached long-TTL (URLs are stable once processed); the actual
files are served via CDN, not application-layer caching at all.
**Error Strategy:** `ValidationError` for disallowed type/size;
`ExternalServiceError` for storage failures. **Validation Strategy:**
Layer 2 declared-type/size check at intent; Layer 3 actual-file-
signature verification at confirmation (Ch. 30).


---

# PART XII — BACKGROUND JOBS CATALOG

| Job | Owning Module | Trigger | Frequency | Idempotency Key |
|---|---|---|---|---|
| Booking Hold Expiration | Booking Holds | Scheduled sweep | Every few seconds | `hold:{holdId}:release` |
| Reminder Emails | Notifications | Scheduled scan of upcoming bookings | Hourly | `reminder-email:{bookingId}:{reminderType}` |
| Reminder SMS | Notifications | Scheduled scan of upcoming bookings | Hourly | `reminder-sms:{bookingId}:{reminderType}` |
| Review Requests | Reviews | Booking reaches `Completed` | Event-triggered, delayed (e.g., +1 hour) | `review-request:{bookingId}` |
| Partner Reports | Reports | Scheduled or partner-requested | Configurable (daily/weekly) | `partner-report:{partnerId}:{period}` |
| Daily Analytics | Analytics | Scheduled | Daily (off-peak) | `analytics-daily:{date}` |
| Weekly Analytics | Analytics | Scheduled | Weekly | `analytics-weekly:{weekStart}` |
| Monthly Reports | Reports | Scheduled | Monthly | `monthly-report:{partnerId}:{month}` |
| Wallet Settlement | Wallet | Scheduled reconciliation | Daily | `wallet-settlement:{date}` |
| Payout Processing | Payouts | Scheduled batch | Weekly (partner-configurable) | `payout-batch:{partnerId}:{period}` |
| Media Cleanup | Media | Scheduled | Daily | `media-cleanup:{date}` |
| Temporary File Cleanup | Media | Scheduled | Hourly | `tmp-cleanup:{date}:{hour}` |
| Failed Payment Retry | Payments | Event-triggered (payment failure) + scheduled backstop scan | Immediate + hourly backstop | `payment-retry:{paymentId}:{attempt}` |
| Webhook Retry | (cross-cutting, Ch. 44) | Event-triggered (delivery failure) | Exponential backoff, up to 24h | `webhook-delivery:{eventId}:{attempt}` |
| Search Index Update | Availability / Listings | Event-triggered (`listing.*`, `availability.updated`) | Near-real-time (queue-driven) | `search-index:{listingId}:{version}` |

Every job in this catalog is registered per Chapter 36's contract
(owning module, queue, concurrency, retry policy, idempotency-key
derivation) — this table is the canonical index; the authoritative
configuration for each lives in its owning module's `jobs/` folder
(Chapter 2).

---

## Appendix A — Redis Keyspace Reference

| Prefix | Purpose | Chapter |
|---|---|---|
| `cache:` | Read-through cache (reference data, hot low-write data) | 39 |
| `lock:` | Distributed mutual-exclusion locks (availability/hold operations) | 42 |
| `session:` | Refresh-token/device tracking (never access-token state) | 12, 38 |
| `ratelimit:` | Sliding-window rate-limit counters | 48 |
| `bull:` | BullMQ's internal queue/job state | 35 |
| `hold:` | Hold-adjacent ephemeral coordination state (not the authoritative hold record itself, which lives in MySQL) | 38, 42 |
| `idempotency:` | (key → response) mapping for idempotent mutation replay | 43 |

## Appendix B — Security Checklist Reference

Every item below is defined in full in Chapter 47 and cross-referenced to
its enforcing mechanism elsewhere in this document; this appendix is the
single-glance audit list used in security review:

- [ ] JWT signature verification on every non-public route (Ch. 12)
- [ ] Refresh token rotation + reuse detection (Ch. 12)
- [ ] RBAC/permission guard on every non-public route (Ch. 13–16)
- [ ] Ownership check at the Service layer for every owner-scoped
      resource (Ch. 13)
- [ ] Layer 2 validation on every mutating endpoint (Ch. 10, 25)
- [ ] Parameterized queries only — no string-concatenated SQL (Ch. 47)
- [ ] User-generated content sanitized at write time (Ch. 47)
- [ ] `SameSite=Strict` refresh cookie + bearer-header requirement on
      state-changing routes (Ch. 47)
- [ ] Helmet security headers applied globally (Ch. 11, 47)
- [ ] CORS origin allowlist, no wildcard in production (Ch. 47)
- [ ] TLS everywhere in transit (Ch. 47)
- [ ] No secret in source control, logs, or error responses (Ch. 19, 20,
      47)
- [ ] Rate limiting on every tier per Ch. 48's documented limits
- [ ] Idempotency key required and enforced on every listed mutation
      (Ch. 43)
- [ ] Audit log written for every privileged/state-changing action
      (Ch. 21)
- [ ] Dependency vulnerability scan passing in CI (Ch. 54, restated from
      `FRONTEND_ARCHITECTURE.md` §34.6's identical frontend-side rule)

---

*— End of BACKEND_ARCHITECTURE.md —*
