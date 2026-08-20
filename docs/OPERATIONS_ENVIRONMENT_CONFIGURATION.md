# Production Environment Configuration

**Status:** P1.8 of the Master Roadmap. This is the reference for what
must actually be configured before Desavii runs in a real production
environment — as distinct from `apps/api/.env.example`/`apps/web/.env.example`
(which enumerate every variable with a safe placeholder) this document
explains *why* each one matters, what happens if it's left at its
development default, and what real-world account/infrastructure it
depends on. Written directly against the current codebase — every
variable named here is confirmed to exist in `apps/api/src/config/index.js`
or `apps/web/.env.example`, not aspirational.

No real secret appears anywhere in this document or in either
`.env.example` file. Production secrets belong in your deployment
platform's own secret manager (or equivalent), never in a committed file.

---

## 1. Database (MySQL 8.x)

`DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_NAME`/`DATABASE_USER`/`DATABASE_PASSWORD`.
Every table is InnoDB with foreign-key constraints — a stock MySQL 8.x
instance (self-hosted or managed, e.g. RDS/Cloud SQL/PlanetScale-compatible)
works with no special configuration. Migrations are applied with
`npm run db:migrate --workspace apps/api`; see
`docs/OPERATIONS_BACKUP_RESTORE.md` for the real, tested backup/restore
procedure this environment needs before it holds real customer data.

## 2. Redis

`REDIS_URL`. Backs rate limiting, login-attempt tracking, and every
BullMQ queue (booking-hold expiry, inventory reconciliation, pending-
vendor SLA sweep, notification delivery, local-payment settlement).
Nothing in Redis is a system of record — losing it resets rate limits
and drops in-flight jobs, never booking/payment/user data — but a
production deployment should still run Redis with persistence enabled
and, at real scale, evaluate a managed/HA Redis rather than a single
uncoordinated instance (a currently-undocumented limitation — this app
has never been run against anything but one Redis instance).

## 3. Payment provider

`PAYMENT_DEFAULT_PROVIDER=local|stripe`, plus `STRIPE_SECRET_KEY`/
`STRIPE_WEBHOOK_SECRET`/`STRIPE_API_VERSION` once `stripe` is selected.
**`local` is the default everywhere today** — `LocalPaymentProvider`
fully simulates payment outcomes and never touches real money; this is
correct for every environment except a genuine production deployment
that intends to accept real payments (P0.1/P0.2 of the Master Roadmap
hardened the Stripe adapter itself — timeouts, retries, idempotency keys,
correct failed-webhook handling — but activating it here is a config
change, not further code work).

Once `stripe` is selected, configure Stripe's dashboard to send webhooks
to `POST https://<your-domain>/api/v1/payments/webhooks/stripe` — the
route is public (no auth token), correctly protected instead by real
HMAC-SHA256 signature verification against `STRIPE_WEBHOOK_SECRET`
(`stripePaymentProvider.js#verifyWebhook`), timing-safe compared.

## 4. Email provider

`EMAIL_PROVIDER=console|resend`, plus `RESEND_API_KEY`/`RESEND_FROM_ADDRESS`
once `resend` is selected. **`console` is the default everywhere today**
— `ConsoleEmailProvider` logs every email as a structured log line
instead of sending it; no customer or partner receives a real email in
any environment until `EMAIL_PROVIDER=resend` (or a future alternative
adapter implementing the same `EmailChannelAdapter` port) is configured
with a real account. This is one of the two things (with payments) most
likely to surprise someone expecting a "normal" production deployment —
until this is set, booking confirmations, cancellations, and refund
notifications are silently console-only.

## 5. AI provider

`AI_DEFAULT_PROVIDER=local|openai|anthropic|gemini|azure-openai|ollama`,
plus the matching provider's API key/model vars. **`local` is the
default everywhere today** — `LocalHeuristicProvider` is a deterministic,
keyword/template composer grounded in real listing/booking data, not a
language model. Every "AI" feature (trip planner, AI search, the
assistant, partner content generation) runs on this composer until a
real provider is configured. Activating a real provider is a genuine
product decision (cost, which model, prompt-injection/abuse
considerations for user-facing generation) — not something to flip on
purely as part of an environment-configuration pass.

## 6. Object storage

`STORAGE_PROVIDER=local|s3`, plus `STORAGE_S3_BUCKET`/`STORAGE_S3_REGION`/
`STORAGE_S3_ENDPOINT`/`STORAGE_S3_ACCESS_KEY_ID`/`STORAGE_S3_SECRET_ACCESS_KEY`/
`STORAGE_S3_FORCE_PATH_STYLE`/`STORAGE_S3_PUBLIC_BASE_URL` once `s3` is
selected. **`local` (disk-backed) is the default everywhere today** —
uploaded listing photos/message attachments/avatars are written to the
container's local filesystem, which does not survive a redeploy and
does not work across more than one running instance. **This one is not
optional for a real multi-instance production deployment** — `s3` (or
any S3-compatible provider: Cloudflare R2, DigitalOcean Spaces, MinIO,
real AWS S3) must be configured before running more than a single
instance, or before any deploy that recreates the container/volume.

## 7. Connector credential encryption

`CONNECTOR_CONFIG_ENCRYPTION_KEY`. Encrypts `inventory_connections.config`
at rest (would hold a real iCal/PMS/OTA API key once a partner connects
a live external calendar). Has a working development default — **a real
production deployment MUST override it** with a real, random secret
(`openssl rand -hex 32`) generated once and never rotated casually
(rotating it without a migration step makes every existing encrypted
`config` row unreadable — there is currently no key-rotation tooling;
treat this the same operational caution as a database credential).

## 8. JWT signing secrets

`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`. Same pattern as above — real
working development defaults, both **must** be overridden with real,
random, per-environment secrets in production. Rotating either
invalidates every currently-issued token of that type (expected,
acceptable — access tokens are short-lived; a refresh-secret rotation
forces every session to re-authenticate).

## 9. Error tracking / observability

`ERROR_TRACKING_PROVIDER=none|sentry`, plus `SENTRY_DSN` once `sentry`
is selected. **`none` is the default everywhere today** — every 5xx
response, uncaught exception, and failed background job is still
logged (structured, redacted), but nothing is forwarded anywhere beyond
stdout. A real production deployment should configure a real DSN before
launch — this is the single biggest gap between "logs exist" and
"someone finds out when something breaks" (see `docs/
OPERATIONS_BACKUP_RESTORE.md`'s disaster-recovery checklist for the
adjacent database-incident story; this is the application-error
equivalent). No frontend-error-tracking integration exists yet — only
the backend gained one (P0.8) — that remains a real, undone gap.

## 10. Public URL / CORS

Backend: `CORS_ALLOWED_ORIGINS` (comma-separated allowlist, no
wildcard — must include the real production frontend origin, e.g.
`https://desavii.com`). Frontend: `VITE_PUBLIC_SITE_URL` (no trailing
slash) — the canonical production origin used to build canonical/
hreflang/OG URLs and the sitemap/robots.txt (Phase 20 SEO).
**The confirmed production domain is `https://desavii.com`** — both of
these must reflect it in a real production deploy; neither should ever
be left at its localhost development default, and neither should ever
be set to an invented/guessed domain.

## 11. Background workers

Five BullMQ workers register themselves in `server.js` at process
start — hold-expiry sweep, inventory-reconciliation sweep, pending-
vendor SLA sweep, notification delivery, and local-payment settlement.
They run in the SAME process as the HTTP server today (no separate
worker deployment/process type exists) — a real production deployment
should decide whether that's acceptable at expected load, or whether
these need splitting into a dedicated worker process/deployment before
they can contend with HTTP request handling for CPU/event-loop time
under real traffic. This is a genuine, currently-undecided operational
question, not something already resolved.

## 12. Rate limiting

`RATE_LIMIT_PUBLIC_PER_MINUTE`/`RATE_LIMIT_AUTHENTICATED_PER_MINUTE`/
`RATE_LIMIT_SENSITIVE_PER_MINUTE` have real, tested production-safe
defaults (20/300/10 per minute) — no action needed unless real traffic
patterns require tuning. `RATE_LIMIT_INTERNAL_BUILD_PER_MINUTE`/
`PRERENDER_INTERNAL_TOKEN` exist only for the build-time SEO prerender
pipeline (Phase 20) — leave `PRERENDER_INTERNAL_TOKEN` unset in a normal
running deployment; it's only needed in whatever environment actually
runs `npm run prerender`.

---

## Quick reference: what MUST change from its development default

| Variable | Dev default | Production requirement |
|---|---|---|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | placeholder string | real, random, per-environment secret |
| `CONNECTOR_CONFIG_ENCRYPTION_KEY` | placeholder string | real, random secret (see §7 on rotation) |
| `CORS_ALLOWED_ORIGINS` | `localhost:5173` | the real production frontend origin |
| `VITE_PUBLIC_SITE_URL` | unset (falls back to localhost) | `https://desavii.com` |
| `STORAGE_PROVIDER` | `local` | `s3` (or equivalent) before any multi-instance/redeploy-surviving deployment |
| `EMAIL_PROVIDER` | `console` | a real provider, before real customers should expect real email |
| `PAYMENT_DEFAULT_PROVIDER` | `local` | `stripe` (with real keys), only once ready to accept real charges — see P0.1/P0.2 |
| `ERROR_TRACKING_PROVIDER` | `none` | a real provider, before launch — this is genuine production blindness otherwise |

Everything else (database/Redis connection details, rate-limit
thresholds, JWT expiry windows, AI provider selection) has a real,
production-safe default or is a deliberate business/product decision
(which AI provider, if any) rather than an operational gap.
