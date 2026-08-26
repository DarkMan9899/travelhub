# Module: partner

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Phase 9 (Partner Dashboard) status:** the full Partner Dashboard is
implemented — `PartnerDashboardOverviewContent` (quick stats, recent
bookings, active/draft listings), `PartnerListingsPageContent` (search/
filter/sort + publish/unpublish/archive/delete actions),
`PartnerBookingsPageContent` + `PartnerBookingDetailContent`
(status filter, list, Confirm/Reject/Cancel actions, lifecycle
timeline), and `PartnerCalendarPageContent` (listing/unit selectors,
`PartnerCalendarEditor` from `@desavii/ui/components/dashboard`,
availability read/write). Each is a thin page-level orchestrator; the
underlying data layer (`useMyListingsQuery`, `usePartnerBookingsQuery`,
`useConfirmBookingMutation`/`useRejectBookingMutation`,
`useSetAvailabilityMutation`, etc.) lives in the `listings`/`bookings`/
`availability` modules per FRONTEND_ARCHITECTURE.md §6.3's dependency
direction (`partner` may depend on all three; the reverse is forbidden).

The earlier `PartnerDashboardContent` `UnderConstructionPage` placeholder
has been fully replaced and deleted.

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
