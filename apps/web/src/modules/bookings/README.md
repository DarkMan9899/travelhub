# Module: bookings

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Phase 7 (Booking Flow) status:** real. `BookingsPageContent` renders the
caller's own "My Trips" list from `GET /bookings` at the `RequireAuth`-guarded
`/:locale/account/bookings` route; `BookingDetailPageContent` (`/:locale/
account/bookings/:id`) shows one booking's full detail with a status-gated
cancel action; `BookingCheckoutPageContent` (`/:locale/booking/checkout`)
converts an active reservation hold (created by `modules/listings`'
`ListingReservationWidget`) into a real, `PENDING_VENDOR` booking via `POST
/bookings`. This is the MVP "request to book, pay at property" model —
see `apps/api/src/infrastructure/database/migrations/0008_bookings.up.sql`'s
own header comment for why there is no online payment/checkout step yet.

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
