# Sprint 6 — Authentication, Authorization, and User Management

This document records what Sprint 6 built and the architecture decisions
made while reconciling the Sprint 6 brief against the already-governed
`BACKEND_ARCHITECTURE.md` / `API_SPECIFICATION.md` /
`FRONTEND_ARCHITECTURE.md` and Sprint 5's database foundation. Like
`docs/SPRINT_5_DATABASE_FOUNDATION.md`, it is an amendment/companion
document, not a replacement.

## 1. Architecture Decisions

### 1.1 "Host" → the existing partner-scoped `OWNER` role

Sprint 6 asks for three roles: Customer, Host, Admin. `API_SPECIFICATION.md`
§32-33 seeds and *protects* exactly seven roles — `super_admin`, `admin`,
`moderator`, `customer` (global) and `partner_owner`, `partner_manager`,
`partner_staff` (partner-scoped) — none named "Host." This is the same
pattern as Sprint 5's Vendor→Partner mapping: "Host" maps onto the
existing partner-scoped `OWNER` role (`partner_employees` +
`partner_employee_roles.OWNER`, both from Sprint 5), not a new row in the
global `roles` table. `src/guards/requireHost.js` implements this
mapping and is integration-tested against the seeded
`vendor@travelhub.dev` account, but no Sprint 6 route mounts it — no
partner-scoped endpoint exists yet (that's the Partner/Vendor Dashboard
sprint's job).

### 1.2 JWT payload carries role codes, not raw numeric IDs

`API_SPECIFICATION.md` §6 describes the access token's payload as
carrying "active role IDs." Sprint 6 embeds role *codes* (`"CUSTOMER"`,
not a numeric `roles.id`) instead — functionally identical (both let
`requireRole` check membership without a database round-trip) but
clearer to read/debug in a decoded token, and avoids `requireRole`
needing a code↔ID lookup table of its own.

### 1.3 Ownership checks live in the Service layer, not a generic guard

`BACKEND_ARCHITECTURE.md` §13 is explicit: ownership checks are
"enforced one layer deeper, inside the Service... since they require
loading the specific resource." `PATCH /users/:id`,
`POST /users/:id/change-password`, and `POST /users/:id/avatar` all use
`requireAuth` at the route layer, then `UserService`'s own "Owner or
`{permission}`" check (`API_SPECIFICATION.md` §5) once the target
resource is loaded. There is no `requireOwner` middleware.

### 1.4 `full_name` → `firstName`/`lastName`

`API_SPECIFICATION.md` §27's register request literally lists a single
`full_name` field. Sprint 5's already-migrated `users` table stores
separate `first_name`/`last_name` columns, and splitting a "full name"
string into first/last is lossy and ambiguous for many real names.
Sprint 6's register/update-profile requests use `firstName`/`lastName`
directly, mapping 1:1 onto the accepted schema instead.

### 1.5 Registration status: `ACTIVE` + `is_email_verified: false`, not a separate "unverified" status

`API_SPECIFICATION.md` §27 says a new account is created with
"`status = unverified`." Sprint 5's `user_statuses` lookup table is
seeded with `ACTIVE`/`SUSPENDED`/`BANNED`/`PENDING_DELETION` — no
"unverified" value — because Sprint 5 already separated *account status*
from *verification state* (`users.is_email_verified`/
`email_verified_at`, both already columns). Sprint 6 keeps that
separation: every new account is `status = ACTIVE` with
`is_email_verified = false`. Gating any action on verification (the
doc's "cannot complete a booking until verified") is deferred — no
booking endpoint exists yet to gate.

### 1.6 Bug fix: `login_history.user_id` made nullable (migration 0013)

Discovered while implementing `login`: Sprint 5's `login_history.user_id`
was `NOT NULL`, but `API_SPECIFICATION.md` §27 requires logging *every*
attempt, including one against an email that belongs to no account —
which has no `user_id` to attach. Fixed via an additive `ALTER TABLE`
(migration `0013`), not by editing the historical migration `0002` file.
This is a genuine bug fix (`CLAUDE.md`'s stated exception for
"a real architectural bug"), not a redesign.

### 1.7 Avatar upload: local storage only, not the general media flow

`API_SPECIFICATION.md` §19 documents a two-step pre-signed-URL flow to
cloud object storage for general media. Sprint 6 explicitly asks for
"storage abstraction only, no cloud integration." `POST /users/:id/avatar`
is a minimal, single-purpose endpoint: a raw binary body
(`express.raw()`, scoped to that one route — no `multer` needed for a
single-file, no-other-fields upload), validated against Sprint 5's
`mediaConstraints.js`, stored via Sprint 5's `LocalStorageProvider`, with
one `media` row created per upload. The general
`POST /media/upload-intent` → `POST /media` flow is deferred to whichever
sprint adds a real cloud `StorageProvider` adapter and a Media module.

### 1.8 New dependency: `cookie-parser`

Required to read back the `Secure`/`HttpOnly`/`SameSite=Strict`
refresh-token cookie web clients rely on
(`FRONTEND_ARCHITECTURE.md` §34.1) — *setting* a cookie needs no extra
package (`res.cookie()` is built into Express), but reading `req.cookies`
back on `/auth/refresh` does. No other new dependencies — `jsonwebtoken`,
`argon2`, `zod`, `express-rate-limit` were already installed; refresh-token
family IDs and hashes reuse `node:crypto`'s `randomUUID`/`createHash`
(matching `requestContext.js`'s existing `request_id` pattern) instead of
the otherwise-unused `uuid` package.

## 2. Database

One new migration, plus one bug-fix migration:

- **`0012_refresh_tokens`**: `refresh_tokens` table — `id`, `user_id`,
  `family_id` (rotation chain), `token_hash` (SHA-256 hex — a signed JWT
  is already high-entropy, so a fast hash is correct here, not Argon2's
  slow one), `device_label`, `replaced_by_token_id` (self-ref), `revoked_at`,
  `expires_at`. No `updated_at` (create-then-revoke, ephemeral — same
  rationale as Sprint 5's `reservation_holds`).
- **`0013_login_history_nullable_user`**: `ALTER TABLE login_history
  MODIFY COLUMN user_id BIGINT UNSIGNED NULL` (§1.6 above).

Seed data addition (not a migration): four new permission rows —
`user.list`, `user.view`, `user.update`, `user.delete` — alongside the
existing `user.suspend`. `ADMIN` picks them up automatically via its
existing "every permission except `role.manage`" seed rule.

## 3. RBAC / Permission Resolution

`API_SPECIFICATION.md` §6/§18: permissions are resolved from role codes
against a 60-second server-side cache, not embedded in the access token,
so a permission revocation takes effect within that bound without
requiring token invalidation.

- `src/core/domain/permissionResolver.js` — pure domain service, DI'd
  with a `PermissionRepository` port (same constructor-injection pattern
  as Sprint 5's `auditLogger.js`).
- `src/infrastructure/database/repositories/permissionRepository.js` —
  DB-backed implementation.
- `src/infrastructure/cache/cachedPermissionRepository.js` — Redis
  caching decorator around it (60s TTL), fails open to an uncached DB
  read on a Redis outage — same discipline as `rateLimiter.js`.
- `src/guards/requirePermission.js` / `requireRole.js` / `requireAuth.js`
  / `requireHost.js` — Express guards. `requireAuth`/`requireRole` are
  stateless (JWT-only); `requirePermission`/`requireHost` are DI'd
  factories, constructed once in `src/app.js`'s composition root and
  passed down to each module's routes, never importing infrastructure
  directly themselves (the crosscutting layer may depend only on `core` +
  `crosscutting`).

## 4. JWT / Refresh Token Design

- **Access token**: 15 minutes (`config.jwt.accessExpiry`), payload
  `{ sub, roles, partnerId }`, verified statelessly (signature + expiry
  only, no DB round-trip) via `src/core/domain/tokenService.js`
  (Sprint 1, reused unchanged — only extended with a `decodeToken` helper
  for reading `exp` off a token this process just signed).
- **Refresh token**: 30 days (`config.jwt.refreshExpiry`), also a signed
  JWT, additionally persisted server-side (hashed) in `refresh_tokens` to
  support rotation/reuse-detection/logout-all.
- **Rotation**: every `/auth/refresh` call issues a new refresh token
  (same `family_id`) and revokes the one just used. A revoked token
  presented again is a reuse signal — the entire family is revoked and
  `AUTH_TOKEN_REUSE_DETECTED` (401) is returned, forcing full
  re-authentication.
- **Web client cookie**: on `login`/`register`/`refresh`, if the request
  carries `X-Client: web`, the refresh token is additionally set as a
  `Secure`/`HttpOnly`/`SameSite=Strict` cookie
  (`FRONTEND_ARCHITECTURE.md` §34.1) — this is this codebase's first use
  of that header; apps/web is still Sprint-1 scaffold, so `"web"` is
  documented here as the value its Axios instance should send.
- **Login lockout**: 5 consecutive failures within 15 minutes locks the
  account (`ACCOUNT_LOCKED`, 423), tracked in Redis
  (`src/modules/auth/services/loginAttemptTracker.js`, keyed by
  normalized email, `SESSION:` prefix), independent of the general rate
  limit.

## 5. Endpoints Implemented

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | `sensitiveRateLimiter` |
| POST | `/api/v1/auth/login` | Public | `sensitiveRateLimiter`, 5-failure lockout |
| POST | `/api/v1/auth/refresh` | Public (token in body/cookie) | `sensitiveRateLimiter`, rotation + reuse detection |
| POST | `/api/v1/auth/logout` | Required | revokes one device's refresh token, idempotent |
| POST | `/api/v1/auth/logout-all` | Required | revokes every refresh token for the account |
| GET | `/api/v1/auth/me` | Required | identity + roles + resolved permissions |
| PATCH | `/api/v1/users/:id` | Required | Owner or `user.update` |
| POST | `/api/v1/users/:id/change-password` | Required | Owner only, no permission fallback |
| POST | `/api/v1/users/:id/avatar` | Required | Owner or `user.update`; raw image body |

## 6. Explicitly Deferred

`forgot-password`/`reset-password` (needs email sending — no
Notifications module), `verify-email`/`verify-phone` (needs code
generation + sending), `GET /users` list/search, `DELETE /users/:id`,
`POST /users/:id/suspend` (admin actions not requested by Sprint 6),
`GET /profiles/*` (no `user_profiles` table — Sprint 5's decision,
unchanged), the general two-step media upload flow, partner-scoped
routes that would actually consume `requireHost`.

## 7. Testing

- **Unit**: `passwordHasher` (Argon2id round-trip), `passwordPolicy`,
  `tokenService` (sign/verify round-trip, expired/foreign-secret
  rejection, `decodeToken`), `permissionResolver` (fake repository),
  `requireAuth`/`requireRole` (mock req/res/next), `LockedError`.
- **Integration** (real MySQL + Redis): full register→login→me→refresh
  (rotation + reuse detection)→logout HTTP flow; login lockout after 5
  failures; `PATCH`/`change-password`/`avatar` ownership enforcement
  (user A blocked from acting on user B); avatar upload end-to-end
  (local disk + `media` row + `avatar_media_id`); `requirePermission`/
  `requireHost` against real seeded roles and the seeded
  `vendor@travelhub.dev`/`customer@travelhub.dev` accounts.
- `tests/integration/helpers/resetRateLimits.js`: a shared test helper
  that clears the Redis-backed rate-limit counters between integration
  test files — `express-rate-limit`'s default IP-based key means every
  supertest request in a run shares one Redis bucket per tier regardless
  of which file issued it; without resetting, a later file's requests
  could spuriously hit `RATE_LIMITED` because of an earlier file's calls.

As with Sprint 5, migrations and integration tests are **unverified
live** in this environment (no Docker/DB access in this sandbox) — run
`npm run docker:up && npm run db:migrate --workspace apps/api && npm run test:integration --workspace apps/api`
to confirm.
