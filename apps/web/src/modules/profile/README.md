# Module: profile

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Phase 8 (Auth / User Dashboard) status:** real. Owns the three
`RequireAuth`-guarded routes `/:locale/account` (`DashboardOverviewContent`
— quick stats + recent/upcoming bookings, reusing the `bookings` module's
own data layer), `/:locale/account/profile` (`ProfilePageContent` — avatar
upload, personal info, language/currency preferences, all via `PATCH
/users/:id` and `POST /users/:id/avatar`), and `/:locale/account/settings`
(`SettingsPageContent` — change password via `POST
/users/:id/change-password`, plus an honest, non-interactive Danger Zone
since no self-service account-deletion endpoint exists). Bookings itself
stays `bookings`-owned, per the cross-module reuse rule.

Deliberately out of scope (documented limitations, not oversights — no
backend support exists for any of these): favorites/saved listings,
reviews, notifications, timezone, and notification preferences. See the
Phase 8 implementation report for the full audit.

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
