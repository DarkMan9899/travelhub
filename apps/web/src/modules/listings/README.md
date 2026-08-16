# Module: listings

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Application Foundation status:** substantially implemented across many
phases — see this module's `index.js` public export surface for the
current set of queries/mutations/components. `useListingQuery` (`GET
/listings/:id`) is this module's own single-listing read; a batch
"published listings" browse (e.g. the Home page's Featured Listings)
goes through the `search` module's `useSearchListingsQuery`/
`SearchResultCard` instead (`GET /search`'s flat DTO needs no per-row
follow-up call — see `FeaturedListings.jsx`'s own header comment for why
this module's `GET /listings` list endpoint isn't used for that).

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
