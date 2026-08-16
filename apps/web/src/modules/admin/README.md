# Module: admin

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Phase 11 status:** `AdminDashboardOverviewContent` (`/:locale/admin`) +
`useAdminDashboardQuery` implemented — the marketplace metrics
dashboard, reusing `packages/ui`'s `StatCard`/`Chart` (`Chart` is new
this phase) rather than page-local widgets. Later Phase 11 stages add
Users/Partners/Listings/Bookings/Configuration/CMS/Audit
Logs/System Health/Settings pages here.

## Folder contents (per FRONTEND_ARCHITECTURE.md §3.2 / §6.2)

- `components/` — module-owned UI, composing `@travelhub/ui` primitives
- `hooks/` — module-specific custom hooks
- `queries/` — React Query query definitions (Ch. 14)
- `mutations/` — React Query mutation definitions (Ch. 14)
- `schemas/` — React Hook Form validation schemas (Ch. 15)
- `utils/` — module-specific pure helpers
- `constants/` — module-specific enums/constants
- `index.js` — this module's public export surface (Ch. 6.2) — the ONLY
  entry point other modules may import from (Ch. 6.3's cross-module rule)
