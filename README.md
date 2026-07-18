# Travel Hub Armenia — Monorepo

A production-ready travel marketplace platform. This repository contains
the customer website, customer account area, partner dashboard, and admin
panel (`apps/web`) alongside the REST API (`apps/api`) and shared
packages, implementing the seven finalized architecture documents in
`docs/`.

## Architecture documents

All engineering decisions in this repository implement, and must never
contradict, the documents in `docs/`:

1. `PROJECT_BIBLE.md`
2. `UI_UX_GUIDELINES.md`
3. `DATABASE_ARCHITECTURE.md`
4. `BOOKING_ENGINE_ARCHITECTURE.md`
5. `API_SPECIFICATION.md`
6. `FRONTEND_ARCHITECTURE.md`
7. `BACKEND_ARCHITECTURE.md`
8. `COMPONENT_LIBRARY.md`
9. `SPRINT_0_IMPLEMENTATION_PLAN.md` (superseded on repo topology — see
   below)

## Repository structure

```
travelhub/
  apps/
    web/            React/Vite frontend — FRONTEND_ARCHITECTURE.md
    api/             Node/Express backend — BACKEND_ARCHITECTURE.md
  packages/
    ui/              Shared design-system component library + design tokens
    shared/          Pure, framework-free utilities shared by web + api
    config/          Shared ESLint/Prettier configuration
    types/           Shared JSDoc type definitions
  docker/            Local development infrastructure (docker-compose.yml)
  docs/              The architecture documents listed above
  scripts/           Operational scripts
  .github/workflows/ CI pipeline
```

**Note on repo topology:** `SPRINT_0_IMPLEMENTATION_PLAN.md` §3.1
originally recommended two separate repositories. That recommendation
was explicitly superseded by direct instruction when Sprint 1 began —
this is one monorepo, per npm workspaces, as built.

## Sprint 1 status (current)

**Goal:** project foundation only — no business logic, no pages, no
APIs beyond a health check, no auth implementation, no booking logic.
See each app's own README for its detailed Sprint 1 checklist:
`apps/api/README.md`, `apps/web/README.md`.

Verified working end-to-end during this sprint (not just reviewed by
eye — actually installed, linted, tested, and built):

- `npm install` resolves the full workspace cleanly
- `npm run lint` — 0 errors across every workspace (a small number of
  intentionally-non-blocking warnings remain in `apps/web`, documented
  inline in `packages/config/src/eslint-frontend.cjs`, tightened to
  errors once real page content exists to translate)
- `npm test` — passes across `apps/api` (unit + integration, the latter
  against real Docker-provisioned MySQL/Redis in CI) and `apps/web`
  (Vitest component test); Playwright E2E harness is configured and
  runs a baseline smoke test
- `npm run build` — produces a working, code-split production bundle
  for `apps/web`
- `GET /health/live` and `GET /health/ready` respond correctly, both via
  `npm run dev` and from a built container image
  (`apps/api/Dockerfile`)
- Husky pre-commit (lint-staged), commit-msg (commitlint), and pre-push
  (unit tests) hooks are installed and verified firing correctly

### Known, tracked issue (not silently ignored)

`npm audit` reports one critical and one high-severity finding, both in
**development-only tooling** (Vite's dev server and Vitest's UI server —
neither ships in the production build). The available fix requires a
major-version bump (Vite 5→6+/8, Vitest 2→3+) which was deliberately
**not** force-applied in this sprint, to avoid destabilizing a foundation
that has just been verified working end-to-end over an unforced upgrade.
This is tracked as a follow-up dependency-upgrade task, not ignored.

## Local Development Workflow

Implements `SPRINT_0_IMPLEMENTATION_PLAN.md` Chapter 18:

```bash
# 1. Use the pinned Node version
nvm use

# 2. Copy environment files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Start backing services (MySQL, Redis, Mailpit, Adminer)
npm run docker:up

# 4. Install dependencies (also installs Husky hooks via `prepare`)
npm install

# 5. Run both apps (in separate terminals)
npm run dev:api
npm run dev:web
```

- API: http://localhost:4000 (`GET /health/live`, `GET /health/ready`)
- Web: http://localhost:5173
- Mailpit UI: http://localhost:8025
- Adminer: http://localhost:8081

Before opening a pull request: `npm run lint && npm test` locally — the
same commands CI runs.

## Scripts (root)

| Script | Purpose |
|---|---|
| `npm run lint` / `lint:fix` | Lint every workspace |
| `npm run build` | Build every workspace with a build step |
| `npm test` | Test every workspace |
| `npm run dev:api` / `dev:web` | Run one app in dev mode |
| `npm run docker:up` / `docker:down` | Start/stop local infrastructure |

## Git & Commit Convention

Trunk-based development, Conventional Commits, enforced by commitlint.
See `SPRINT_0_IMPLEMENTATION_PLAN.md` Chapters 8 and 13 for the full
policy. Example: `feat(booking-holds): add reservation hold repository`.
