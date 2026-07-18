# @travelhub/api

Travel Hub Armenia backend — Node.js/Express, implementing
`BACKEND_ARCHITECTURE.md` exactly.

## Sprint 1 status

Foundation only — see `SPRINT_1` scope in the root `README.md`. What
exists and is verified working:

- Clean Architecture folder structure (`src/core`, `src/infrastructure`,
  `src/middleware`, etc. — `BACKEND_ARCHITECTURE.md` §2-3)
- Structured logger with automatic secret redaction (`src/logging`)
- Fail-fast configuration loader (`src/config`)
- Global error handler + full Exception Hierarchy (`src/errors`,
  `src/middleware/errorHandler.js`)
- Generic Zod-based validation middleware factory (`src/validation`)
- JWT sign/verify utilities — **not** wired to any login/auth route yet
  (`src/core/domain/tokenService.js`)
- MySQL connection pool + Redis client, both with bounded, fail-fast
  connection/retry behavior (`src/infrastructure/database`,
  `src/infrastructure/cache`)
- BullMQ connection (`src/infrastructure/queue`) — no queues/jobs
  registered yet
- `GET /health/live` and `GET /health/ready` — the one real, working
  endpoint this sprint produces
- All 32 business modules scaffolded under `src/modules/` (folder
  structure + README only — **no controllers, services, or business
  logic**)

## Local development

See the root `README.md`'s Local Development Workflow section. In short:

```
docker compose -f ../../docker/docker-compose.yml up -d
cp .env.example .env
npm run dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm run lint` / `lint:fix` | ESLint (Clean Architecture boundary rules included) |
| `npm test` | Unit tests only (fast, no infrastructure required) |
| `npm run test:integration` | Integration tests (requires Docker services running) |
| `npm run test:all` | Every test project |
