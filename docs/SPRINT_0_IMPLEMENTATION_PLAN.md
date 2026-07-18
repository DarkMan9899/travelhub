# SPRINT 0 IMPLEMENTATION PLAN

**Travel Hub Armenia — Engineering Kickoff**
**Status:** Final · **Version:** 1.0 · **Classification:** Confidential
**Owner:** Chief Backend Architect / Chief Frontend Architect (joint)
**Depends on (must never be contradicted):** `PROJECT_BIBLE.md` · `UI_UX_GUIDELINES.md` · `DATABASE_ARCHITECTURE.md` · `BOOKING_ENGINE_ARCHITECTURE.md` · `API_SPECIFICATION.md` · `FRONTEND_ARCHITECTURE.md` · `BACKEND_ARCHITECTURE.md`

---

This document plans **Sprint 0 only** — the sprint before any feature work
begins. Sprint 0 produces zero customer-facing functionality. Its entire
purpose is to make every rule already fixed in the six prior documents
mechanically enforceable — in tooling, in CI, in the repository structure
itself — from the very first feature pull request onward, so that no
future sprint has to "remember" a rule that a linter, a pre-commit hook,
or a CI gate could have enforced instead.

No architecture decision in this document revisits the six prior
documents. Every structural, tooling, and process choice below either
implements something those documents already specified, or — where a
genuine implementation-level ambiguity exists that they did not resolve
(e.g., one repository vs. two) — makes an explicit, justified decision
consistent with everything already fixed.

## Table of Contents

1. Sprint Goal
2. Deliverables
3. Folder Structure
4. Packages to Install
5. Dependencies
6. Development Environment
7. Docker Services
8. Git Strategy
9. Coding Standards
10. Linting
11. Formatting
12. Husky
13. Commit Convention
14. Environment Variables
15. Build Pipeline
16. CI/CD Pipeline
17. Testing Setup
18. Local Development Workflow
19. Acceptance Criteria
20. Definition of Done

---

## 1. Sprint Goal

Stand up two empty-but-fully-scaffolded, independently deployable
repositories — **`travelhub-backend`** and **`travelhub-frontend`** — such
that: every folder boundary from `BACKEND_ARCHITECTURE.md` §2 and
`FRONTEND_ARCHITECTURE.md` §3 exists and is lint-enforced; every tooling
decision (linting, formatting, commit convention, testing framework) is
installed and wired into a pre-commit hook and a CI pipeline; the full
local development stack (MySQL, Redis, and their supporting services)
runs via one Docker Compose command; and both repositories' CI pipelines
go green on an empty scaffold containing nothing but structure,
configuration, and a single health-check endpoint.

**Sprint 0 produces no business feature.** Its Definition of Done
(Chapter 20) is deliberately about *infrastructure and discipline*, not
functionality — Sprint 1 is the first sprint permitted to touch a real
module from `BACKEND_ARCHITECTURE.md` Part XI or a real feature module
from `FRONTEND_ARCHITECTURE.md` Chapter 6.

## 2. Deliverables

- [ ] `travelhub-backend` repository created, with the complete folder
      structure from `BACKEND_ARCHITECTURE.md` §2 present (empty module
      directories under `src/modules/` per Part XI's 33-module catalog,
      each with a placeholder `README.md` stating its owning team and a
      link back to its Part XI entry — no logic).
- [ ] `travelhub-frontend` repository created, with the complete folder
      structure from `FRONTEND_ARCHITECTURE.md` §3 present (empty module
      directories under `src/modules/` per Chapter 6's 23-module list,
      same placeholder-README convention).
- [ ] `docker-compose.yml` bringing up MySQL, Redis, and supporting local
      services (Chapter 7) with a single command.
- [ ] ESLint, Prettier, Husky, and commitlint installed and configured in
      both repositories (Chapters 9–13).
- [ ] CI pipeline (lint → test → build) green in both repositories
      against the empty scaffold (Chapter 16).
- [ ] `.env.example` present in both repositories, enumerating every
      required variable with a placeholder value (Chapter 14) — no real
      secret ever committed.
- [ ] One real, working endpoint in the backend: `GET /health/live` and
      `GET /health/ready` (`BACKEND_ARCHITECTURE.md` §50) — the only
      functional code Sprint 0 produces, and only because it is required
      to prove the Docker/CI/deployment pipeline actually works
      end-to-end.
- [ ] One real, working route in the frontend: a placeholder root route
      rendering the `PublicLayout` shell (`FRONTEND_ARCHITECTURE.md` §5.1)
      with no page content — proving the routing, locale-prefix, and
      build pipeline work end-to-end.
- [ ] A shared `docs/` folder in each repository containing (or linking
      to) all six upstream architecture documents, so every engineer
      onboarding in Sprint 1 has them one click away from the code.
- [ ] Onboarding `README.md` in both repositories covering Chapter 18's
      Local Development Workflow verbatim.

## 3. Folder Structure

### 3.1 Two Repositories, Not One Monorepo — The Decision

**Decision: two independent repositories**, `travelhub-backend` and
`travelhub-frontend`, not a monorepo.

`BACKEND_ARCHITECTURE.md` §58 and `FRONTEND_ARCHITECTURE.md` §38 already
independently specify two fully distinct deployment models — the backend
is a containerized, horizontally-scaled Node service; the frontend is a
static/SSR build served via CDN with a separate client-rendered shell.
These were written as two independent contracts with two independent CI/
CD pipelines already, before this document existed. A monorepo would
require introducing new tooling (Turborepo/Nx-class build orchestration)
solely to manage a coupling that does not otherwise exist — the two
codebases share no code, only a contract (`API_SPECIFICATION.md`) that is
already versioned and stable on its own. Two repositories is the simpler
option that satisfies every existing constraint, and is therefore the
correct one under Chapter 1 of `BACKEND_ARCHITECTURE.md`'s KISS principle.
Should backend and frontend ever need coordinated atomic releases in the
future, that is the trigger to revisit this decision — not a reason to
adopt monorepo tooling pre-emptively.

### 3.2 `travelhub-backend` Root Layout

```
travelhub-backend/
  src/                      — exactly the structure in BACKEND_ARCHITECTURE.md §2
  tests/                    — unit/ integration/ contract/ fixtures/ (§54-57)
  docs/                     — copies of/links to the six upstream architecture docs
  docker/                   — Dockerfile, docker-compose.yml, service init scripts
  scripts/                  — one-off operational scripts (migration runner, seed data)
  .github/workflows/        — CI/CD pipeline definitions (Ch. 16)
  .husky/                   — git hook scripts (Ch. 12)
  .env.example
  .eslintrc.*
  .prettierrc.*
  commitlint.config.*
  package.json
  README.md
```

### 3.3 `travelhub-frontend` Root Layout

```
travelhub-frontend/
  src/                      — exactly the structure in FRONTEND_ARCHITECTURE.md §3
  tests/                    — mirrors the src/ module boundaries (Ch. 35)
  docs/
  .github/workflows/
  .husky/
  public/                   — static assets not processed by the build (favicon, robots.txt)
  .env.example
  .eslintrc.*
  .prettierrc.*
  commitlint.config.*
  vite.config.js
  package.json
  README.md
```

### 3.4 Sprint 0 Scaffolding Rule

Every module folder created in Sprint 0 is created **empty except for a
placeholder `README.md`** — Sprint 0 explicitly does not populate any
module with its first real Controller/Service/Component, since that is
feature work belonging to Sprint 1 and beyond, scoped per module per the
team assignments in `BACKEND_ARCHITECTURE.md` Part XI and
`FRONTEND_ARCHITECTURE.md` Chapter 6.4.

## 4. Packages to Install

### 4.1 Backend (`travelhub-backend`)

| Concern | Package(s) |
|---|---|
| HTTP framework | `express` |
| MySQL driver | `mysql2` |
| Redis client | `ioredis` |
| Queue | `bullmq` |
| Auth | `jsonwebtoken`, `argon2` |
| Validation | `zod` |
| Security middleware | `helmet`, `cors`, `express-rate-limit` |
| Logging | `pino`, `pino-http` |
| Config loading | `dotenv`, `envalid` (fail-fast env validation, `BACKEND_ARCHITECTURE.md` §18) |
| Cloud storage SDK | `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` |
| Email provider SDK | provider-specific adapter package (selected during Sprint 0's external-account provisioning, §5.3) |
| SMS provider SDK | provider-specific adapter package (same) |
| Payment gateway SDK | provider-specific adapter package (same) |
| Real-time (future-ready) | `socket.io` (installed, not wired to any route yet — per the brief's "future ready" instruction) |
| IDs | `uuid` |
| Testing | `jest`, `supertest`, `@faker-js/faker` (fixtures) |
| Contract testing | `express-openapi-validator` (validates live responses against the `API_SPECIFICATION.md` OpenAPI bundle, `BACKEND_ARCHITECTURE.md` §57) |
| Linting/formatting | `eslint`, `eslint-plugin-import`, `eslint-plugin-boundaries`, `prettier`, `eslint-config-prettier` |
| Git hooks | `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional` |
| Dev tooling | `nodemon` |

### 4.2 Frontend (`travelhub-frontend`)

| Concern | Package(s) |
|---|---|
| Core | `react`, `react-dom` |
| Routing | `react-router-dom` |
| HTTP client | `axios` |
| Server state | `@tanstack/react-query` |
| Forms | `react-hook-form` |
| Animation | `framer-motion` |
| i18n | `i18next`, `react-i18next`, `i18next-http-backend`, `i18next-browser-languagedetector` |
| Styling | `sass` (SCSS compilation, `FRONTEND_ARCHITECTURE.md` §9 — no CSS-in-JS, no utility framework) |
| Dates | `date-fns`, `date-fns-tz` |
| Icons | `lucide-react` (or the icon set selected against `UI_UX_GUIDELINES.md` §7's outline-style requirement) |
| Build tool | `vite`, `@vitejs/plugin-react` |
| Testing | `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` |
| API mocking (tests) | `msw` |
| E2E | `@playwright/test` |
| Accessibility testing | `@axe-core/playwright` |
| Linting/formatting | `eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `eslint-plugin-import`, `eslint-plugin-boundaries`, `prettier`, `eslint-config-prettier` |
| Git hooks | `husky`, `lint-staged`, `@commitlint/cli`, `@commitlint/config-conventional` |

**Rule for both repositories:** no package is added to `package.json`
outside this table during Sprint 0 without being added to this document
first — Sprint 0's package list is itself part of the reviewed plan, not
a running total accumulated ad hoc.

## 5. Dependencies

### 5.1 Runtime and Tooling Versions

| Tool | Version | Enforced by |
|---|---|---|
| Node.js | Latest LTS at sprint start, pinned exactly | `.nvmrc` in both repos + CI matrix |
| npm | Version bundled with the pinned Node LTS | `package.json` `engines` field |
| MySQL | 8.x (matching `DATABASE_ARCHITECTURE.md`'s InnoDB/JSON-column assumptions) | Docker image tag pin (Ch. 7) |
| Redis | 7.x | Docker image tag pin (Ch. 7) |

### 5.2 Inter-Document Dependency

This plan depends on all six upstream documents being genuinely final —
Sprint 0 is the wrong time to discover an unresolved question in any of
them. Any such gap discovered during scaffolding is raised as a
documentation amendment request against the relevant upstream document
**before** Sprint 0 proceeds past that point, never quietly resolved
ad hoc inside a config file.

### 5.3 External Account Prerequisites (Blocking)

The following third-party accounts/sandboxes must exist before Sprint 0
can be marked done, since `.env.example` (Chapter 14) and the External
Integrations adapters (`BACKEND_ARCHITECTURE.md` §45) name them
explicitly:

- [ ] Payment gateway sandbox account and API credentials
- [ ] Email provider sandbox account and API credentials
- [ ] SMS provider sandbox account and API credentials
- [ ] Cloud object storage bucket (staging) and access credentials
- [ ] A registered domain/subdomain for staging deployments (Chapter 16)

These are tracked as blocking tickets owned by the platform/DevOps
sub-team, separate from the scaffolding work itself, so scaffolding is
not held up waiting on procurement — the scaffolding uses placeholder
`.env.example` values regardless and Sprint 0's CI never requires real
third-party credentials to go green (Chapter 16).

## 6. Development Environment

- **Node version management:** `nvm`, with `.nvmrc` committed at the
  root of both repositories; `nvm use` is the first documented step of
  Chapter 18's workflow.
- **Editor configuration:** a committed `.editorconfig` (indent style,
  charset, line endings) in both repositories, plus a recommended VS Code
  workspace settings file (`.vscode/extensions.json` recommending the
  ESLint, Prettier, and EditorConfig extensions) — recommended, never
  enforced at the tooling level, since CI/hooks are the actual gate
  (Chapters 10–12), not editor configuration.
- **Local `.env`:** every developer copies `.env.example` to `.env`
  (git-ignored) and fills in local/sandbox values; no repository ever
  contains a committed `.env` file.
- **Local secrets for external services** (§5.3) are shared to
  engineers via the team's secret-management tool (not committed, not
  shared over chat/email) — out of scope for this document's detail, but
  explicitly never via a checked-in file.

## 7. Docker Services

A single root-level `docker-compose.yml` per repository (the backend
repo's compose file is the canonical one; the frontend repo needs no
backing services of its own beyond pointing its `.env` at the backend's
locally-running API):

```
services:
  mysql:
    image: mysql:8.x
    ports: ["3306:3306"]
    environment: (root password, database name — from .env, never hardcoded)
    volumes: (named volume for data persistence across restarts)
  redis:
    image: redis:7.x
    ports: ["6379:6379"]
  mailhog:                      # local email-capture for development (never a real send)
    image: mailhog/mailhog
    ports: ["1025:1025", "8025:8025"]
  adminer:                      # optional local DB inspection UI
    image: adminer
    ports: ["8081:8080"]
```

The application (Express) itself runs **outside** Docker during local
development, directly via `nodemon` against these containerized
services — this keeps hot-reload fast and avoids rebuilding a container
image on every save; a production-equivalent Dockerfile for the
application itself is built and validated in CI (Chapter 16) but is not
part of the everyday local inner-loop.

## 8. Git Strategy

- **Trunk-based development**, not GitFlow: one long-lived `main` branch,
  short-lived feature branches (`feature/{module}-{short-description}`,
  `fix/{module}-{short-description}`, `chore/{short-description}`),
  merged via pull request after CI passes and at least one review
  approval — matching the continuous, rolling deployment model both
  `BACKEND_ARCHITECTURE.md` §58 and `FRONTEND_ARCHITECTURE.md` §38
  already specify (blue-green/rolling deploys assume a single deployable
  `main`, not long-lived release branches to reconcile).
- **`main` is always protected:** direct pushes disabled, CI must pass,
  at least one approval required, before merge.
- **Merge strategy:** squash-merge only, so `main`'s history is one
  commit per pull request, matching the Commit Convention (Chapter 13)
  cleanly.
- **Branch ownership:** a feature branch's name always includes the
  owning module (per `BACKEND_ARCHITECTURE.md` Part XI /
  `FRONTEND_ARCHITECTURE.md` Chapter 6's module list), so CI history and
  `git log` are immediately legible by domain.

## 9. Coding Standards

Restated from `BACKEND_ARCHITECTURE.md` Chapter 1 and
`FRONTEND_ARCHITECTURE.md` Chapter 39 as Sprint-0-enforceable rules:

- **Clean Architecture's Dependency Rule** (`BACKEND_ARCHITECTURE.md`
  §3) and the module cross-dependency direction rule
  (`FRONTEND_ARCHITECTURE.md` §6.3) are configured as **lint rules**
  (Chapter 10), not left to code review discipline alone — Sprint 0's job
  is to make an architecture violation a red CI check, not a comment on a
  pull request.
- One export per file for Services/Repositories/Components; colocated
  tests; no default exports for anything other than a React component or
  a module's single public entry file (`index.js`), keeping
  import statements self-documenting.
- No commented-out code committed to `main` — deleted code is retrieved
  from git history, never left inline "in case it's needed."
- No `TODO` comment without a linked ticket reference.

## 10. Linting

- **ESLint**, one shared base config per repository (`eslint-config-airbnb-base`
  for the backend, `eslint-config-airbnb` + the React/hooks/jsx-a11y
  plugins for the frontend), extended — never overridden — by a small,
  additional ruleset specific to this platform:
  - `eslint-plugin-boundaries` (or an equivalent `import/no-restricted-paths`
    configuration) encoding the exact module-dependency directions from
    `BACKEND_ARCHITECTURE.md` §4/§59 and `FRONTEND_ARCHITECTURE.md` §6.3 —
    configured once in Sprint 0, against the empty module folders, so the
    very first feature pull request in Sprint 1 is already constrained by
    it.
  - A custom rule (or a configured `no-restricted-syntax`) flagging any
    hardcoded, untranslated string literal inside frontend JSX text
    content, implementing `FRONTEND_ARCHITECTURE.md` §16.5's requirement
    from day one.
  - `eslint-plugin-jsx-a11y` at its recommended-strict preset (frontend),
    implementing `FRONTEND_ARCHITECTURE.md` §30's accessibility floor at
    the lint level.
- **No per-module ESLint override** — one config per repository, applied
  uniformly, matching `FRONTEND_ARCHITECTURE.md` §39's "no per-module
  overrides" rule exactly (and applied identically on the backend).
- Lint runs as a pre-commit hook (staged files only, Chapter 12) and as a
  full-repository CI check (Chapter 16) — the two are complementary, not
  redundant: pre-commit gives instant local feedback; CI is the
  authoritative gate no local hook bypass can circumvent.

## 11. Formatting

- **Prettier**, one shared config per repository, values fixed here so
  there is never a formatting debate in review:

| Setting | Value |
|---|---|
| `printWidth` | 80 |
| `tabWidth` | 2 |
| `semi` | true |
| `singleQuote` | true |
| `trailingComma` | `all` |
| `arrowParens` | `always` |
| `endOfLine` | `lf` |

- `eslint-config-prettier` disables every ESLint stylistic rule that
  would otherwise conflict with Prettier, so the two tools never fight
  over the same line.
- Formatting is auto-applied at commit time (Chapter 12) — no pull
  request should ever contain a formatting-only review comment; if one
  is needed, the hook configuration itself has a gap and is fixed, not
  the individual file.

## 12. Husky

Git hooks installed via Husky in both repositories:

| Hook | Action |
|---|---|
| `pre-commit` | `lint-staged` — runs ESLint `--fix` and Prettier `--write` on staged files only |
| `commit-msg` | `commitlint` — validates the commit message against Chapter 13's convention |
| `pre-push` | Runs the unit test suite (`BACKEND_ARCHITECTURE.md` §55 / `FRONTEND_ARCHITECTURE.md` §35's unit layer) — integration/contract/E2E suites are **not** run pre-push (too slow for the local inner loop); they run in CI (Chapter 16) on every pushed branch instead |

No hook is ever bypassed with `--no-verify` as standard practice — a
bypass is an exceptional, individually-justified action, not a normal
part of the workflow, and CI re-runs everything regardless (hooks are a
fast local courtesy, never the actual enforcement boundary).

## 13. Commit Convention

**Conventional Commits**, enforced by commitlint (Chapter 12):

```
{type}({scope}): {short description}

type: feat | fix | chore | docs | refactor | test | ci | build | perf
scope: the owning module name, matching BACKEND_ARCHITECTURE.md Part XI
       or FRONTEND_ARCHITECTURE.md Chapter 6 exactly (e.g., "booking-holds",
       "availability", "auth") — or "repo" for root-level tooling changes
       not owned by any one module
```

Examples: `feat(booking-holds): scaffold module folder structure`,
`chore(repo): configure ESLint boundary rules`,
`ci(repo): add contract-test stage to pipeline`.

Using the same module-name vocabulary as the two architecture documents'
own module catalogs is deliberate — `git log --grep` against a module
name and that module's Part XI/Chapter 6 entry are always talking about
the same thing.

## 14. Environment Variables

`.env.example` in each repository enumerates every required key with a
placeholder value — no real secret is ever committed, matching
`BACKEND_ARCHITECTURE.md` §19 and `FRONTEND_ARCHITECTURE.md` §37 exactly.

### 14.1 Backend `.env.example` Categories

```
NODE_ENV=
PORT=
DATABASE_HOST= / DATABASE_PORT= / DATABASE_NAME= / DATABASE_USER= / DATABASE_PASSWORD=
REDIS_URL=
JWT_ACCESS_SECRET= / JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m / JWT_REFRESH_EXPIRY=30d
CLOUD_STORAGE_BUCKET= / CLOUD_STORAGE_REGION= / CLOUD_STORAGE_ACCESS_KEY= / CLOUD_STORAGE_SECRET_KEY=
PAYMENT_GATEWAY_API_KEY= / PAYMENT_GATEWAY_WEBHOOK_SECRET=
EMAIL_PROVIDER_API_KEY=
SMS_PROVIDER_API_KEY=
MONITORING_ENDPOINT=
RESERVATION_HOLD_DURATION_MINUTES=15
```

### 14.2 Frontend `.env.example` Categories

```
VITE_API_BASE_URL=
VITE_ENVIRONMENT_NAME=
VITE_MONITORING_ENDPOINT=
VITE_MAPS_API_KEY=
VITE_DEFAULT_LOCALE=hy
```

**Rule (restated from both architecture documents):** no secret — a
payment gateway key, a signing secret, a provider API key — is ever
placed in a `VITE_`-prefixed (or any frontend-bundled) variable, since
anything with that prefix is compiled into publicly-served JavaScript.

## 15. Build Pipeline

- **Backend:** no transpilation step (plain JavaScript, Node's native
  module support) — the "build" is: install dependencies, run lint and
  tests, then build a production container image (Chapter 7's Dockerfile,
  validated but not run locally day-to-day).
- **Frontend:** Vite production build (`FRONTEND_ARCHITECTURE.md` §38) —
  install dependencies, run lint and tests, `vite build`, then validate
  the resulting bundle against the size budget
  (`FRONTEND_ARCHITECTURE.md` §32.1) — Sprint 0 establishes this budget
  check in CI against the empty scaffold's baseline bundle size, so any
  future regression is measured against a real number from day one, not
  an arbitrary later guess.

## 16. CI/CD Pipeline

One pipeline per repository, triggered on every pull request and on
merge to `main`. Sprint 0 wires every stage below to a green, meaningful
check — even against the empty scaffold — but the **deploy** stage is
intentionally a no-op placeholder in Sprint 0 (there is nothing to
deploy yet beyond the health check); wiring a real deploy target is
explicitly deferred to whichever sprint first ships a real feature,
tracked as a follow-up, not silently skipped.

### 16.1 Backend Pipeline Stages

```
lint → unit tests → integration tests (against Dockerized MySQL/Redis
  service containers spun up by the CI runner itself) → contract tests
  (validate the (currently near-empty) API surface against the
  API_SPECIFICATION.md OpenAPI bundle) → build container image →
  [staging deploy — placeholder in Sprint 0]
```

### 16.2 Frontend Pipeline Stages

```
lint → unit/component tests → build → bundle-size budget check →
  Lighthouse CI (against the placeholder route) → accessibility scan
  (axe, against the placeholder route) → [staging deploy — placeholder
  in Sprint 0]
```

Every stage failing blocks merge — Sprint 0's explicit goal is that this
is true from the first pull request onward, never phased in gradually
after feature work has already started.

## 17. Testing Setup

- **Backend:** Jest configured with a `unit/`, `integration/`, and
  `contract/` test-path convention mirroring
  `BACKEND_ARCHITECTURE.md` §54; Supertest wired for
  Controller-level integration tests against an in-process Express app;
  a documented pattern for spinning up ephemeral, Dockerized MySQL/Redis
  instances specifically for the integration suite (never shared,
  stateful test infrastructure that could leak state between test runs).
- **Frontend:** Vitest + React Testing Library configured with a custom
  render utility (pre-wrapped with the provider tree —
  `FRONTEND_ARCHITECTURE.md` §35) established in Sprint 0 so every future
  component test starts from the same baseline; Mock Service Worker
  configured to intercept `API_SPECIFICATION.md`-shaped requests at the
  network layer for integration-level component tests; Playwright
  installed and configured with a baseline empty-scaffold smoke test
  (the placeholder route loads, responds to a locale switch) proving the
  E2E pipeline itself works end-to-end before any real journey exists to
  test.
- Both repositories' CI (Chapter 16) run their full test suite on every
  pull request — Sprint 0's tests are minimal (there is almost nothing
  to test yet) but the **harness** — commands, CI wiring, fixture
  conventions — is complete and proven working.

## 18. Local Development Workflow

1. Clone the relevant repository (`travelhub-backend` and/or
   `travelhub-frontend`).
2. `nvm use` (Chapter 6) to select the pinned Node version.
3. Copy `.env.example` to `.env` and fill in local/sandbox values
   (Chapter 14); for the frontend, set `VITE_API_BASE_URL` to the
   locally-running backend's address.
4. **Backend only:** `docker compose up -d` (Chapter 7) to start MySQL
   and Redis.
5. `npm install`.
6. **Backend:** `npm run dev` (nodemon, hot-reloading against the Docker
   services). **Frontend:** `npm run dev` (Vite dev server).
7. Husky hooks (Chapter 12) are installed automatically via an
   `npm postinstall` script — no manual setup step required beyond
   `npm install`.
8. Before opening a pull request: `npm run lint`, `npm test` locally
   (the same commands CI runs), so CI failures are never the first time
   an engineer learns something is broken.

## 19. Acceptance Criteria

Sprint 0 is accepted when every item below is independently verifiable
by any engineer, not merely asserted by whoever performed the work:

- [ ] A new engineer can go from `git clone` to a running local stack
      (both repositories) by following Chapter 18 alone, with no
      undocumented step.
- [ ] `docker compose up -d` brings up MySQL and Redis with no manual
      configuration beyond a filled-in `.env`.
- [ ] Both repositories' folder structures match
      `BACKEND_ARCHITECTURE.md` §2 and `FRONTEND_ARCHITECTURE.md` §3
      exactly, module-for-module.
- [ ] Committing a deliberately malformed commit message is rejected by
      commitlint; committing deliberately unformatted code is
      auto-fixed by lint-staged; committing a deliberate architecture-
      boundary violation (a module importing another module's internal
      file) is rejected by the ESLint boundary rule — all three verified
      by a real, attempted-and-observed test during Sprint 0 review, not
      assumed from configuration alone.
- [ ] Both CI pipelines are green on the empty scaffold, including the
      contract-test stage validating the health-check endpoint against
      the OpenAPI bundle.
- [ ] `GET /health/live` and `GET /health/ready` respond correctly from
      a locally built and run container image, not only from `npm run dev`.
- [ ] The frontend's placeholder route renders under all three locale
      prefixes (`/hy/`, `/ru/`, `/en/`) and correctly 404s on an invalid
      locale segment (`FRONTEND_ARCHITECTURE.md` §4.1).
- [ ] No secret exists in either repository's git history (verified by a
      secret-scanning check as part of this sprint's review, not assumed).

## 20. Definition of Done

Sprint 0 is done when:

- [ ] All Chapter 19 acceptance criteria pass.
- [ ] All Chapter 2 deliverables exist and are merged to `main` in both
      repositories.
- [ ] All Chapter 5.3 external-account prerequisites are either
      provisioned or explicitly, separately ticketed as in-progress
      without blocking Sprint 1's start (Sprint 1's first features may
      not need every external integration on day one — e.g., payment
      integration work can begin against a sandbox even if email
      provider procurement is still finalizing).
- [ ] Both repositories' `README.md` fully documents Chapter 18's
      workflow, verified by having a second engineer (not the one who
      built the scaffold) follow it from a clean machine successfully.
- [ ] This document, and all six upstream architecture documents, are
      linked from both repositories' `docs/` folders and referenced from
      their root `README.md`.
- [ ] No architecture, database, API, Booking Engine, or UI/UX decision
      from the six prior documents was altered, reinterpreted, or worked
      around during scaffolding — any point where scaffolding seemed to
      require such a change was raised and resolved as a documentation
      question first, per §5.2, never silently decided in code.
- [ ] The team explicitly confirms Sprint 0 is closed in a sprint
      review, and Sprint 1 planning — the first sprint permitted to
      implement a real module — begins only after that confirmation.

---

*— End of SPRINT_0_IMPLEMENTATION_PLAN.md —*
