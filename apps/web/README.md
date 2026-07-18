# @travelhub/web

Travel Hub Armenia frontend — React/Vite, implementing
`FRONTEND_ARCHITECTURE.md` exactly.

## Sprint 1 status

Foundation only. What exists and is verified working:

- Locale-prefixed routing (`/hy`, `/ru`, `/en`) with validation and a
  404 fallback for unsupported segments (`FRONTEND_ARCHITECTURE.md` §4.1)
- `PublicLayout` structural shell + one placeholder route
  (`ComingSoonPage`) — no real pages
- i18next wired with the `common` namespace in all three locales
- SCSS pipeline consuming `@travelhub/ui`'s design tokens
- `AppProviders` composing React Query + React Router (no Context
  providers yet — none has a real consumer this sprint)
- Axios client foundation (base URL, locale header) — **no auth token
  wiring**, per this sprint's explicit scope
- All 23 feature modules scaffolded under `src/modules/` (folder
  structure + README + empty public export only)
- Vitest + React Testing Library harness, proven via one smoke test
- Playwright harness, proven via one smoke test

## Local development

```
cp .env.example .env
npm run dev
```

Requires `apps/api` running locally (Vite proxies `/api` to it in dev,
see `vite.config.js`).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` / `lint:fix` | ESLint (module-boundary + a11y rules included) |
| `npm test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright |
