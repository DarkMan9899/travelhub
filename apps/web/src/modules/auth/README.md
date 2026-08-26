# Module: auth

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Application Foundation status:** implemented. `LoginForm`/`RegisterForm`
(React Hook Form + `Controller`, validation mirroring the backend's Zod
rules including the password-strength policy) wired to the real
`POST /auth/login`/`POST /auth/register` endpoints via
`AuthProvider`/`AuthContext` (`apps/web/src/providers`,
`apps/web/src/contexts`) — session bootstrap, refresh, and logout all
live there, not in this module, since they're app-wide concerns
(FRONTEND_ARCHITECTURE.md §11), not one feature module's.

## Folder contents (per FRONTEND_ARCHITECTURE.md §3.2 / §6.2)

- `components/` — module-owned UI, composing `@desavii/ui` primitives
- `hooks/` — module-specific custom hooks
- `queries/` — React Query query definitions (Ch. 14)
- `mutations/` — React Query mutation definitions (Ch. 14)
- `schemas/` — React Hook Form validation schemas (Ch. 15)
- `utils/` — module-specific pure helpers
- `constants/` — module-specific enums/constants
- `index.js` — this module's public export surface (Ch. 6.2) — the ONLY
  entry point other modules may import from (Ch. 6.3's cross-module rule)
