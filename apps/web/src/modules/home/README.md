# Module: home

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it
consumes.

**Phase 3 status (Premium Homepage):** implemented. The Homepage is now
the full marketplace landing page — Hero (with the search widget),
Featured Destinations, Featured Listings, Popular Experiences,
Categories, Why TravelHub, Become a Partner CTA, Testimonials, and
Newsletter — composed in `pages/HomePage.jsx` from this module's public
export surface (`index.js`). Phase 1's `FeaturedListings` is unchanged
in behavior, just re-styled to match the rest of the page (shared
`SectionHeader`/`ScrollReveal`) and linked to the listing detail route.

Real vs. placeholder content:

- **Real, API-backed:** Featured Listings (`useSearchListingsQuery`/
  `SearchResultCard`, via the `search` module's public export).
- **Real, not API-backed:** Categories (derived from the existing
  `listings.type` enum — a real taxonomy, just not filterable via the
  Search page yet).
- **Placeholder** (no corresponding API exists this phase — see each
  file's own header comment): Featured Destinations, Popular
  Experiences, Testimonials (`constants/`), and the Newsletter form
  (`hooks/useNewsletterSubscribe.js` — UI-only, no subscription is
  actually sent anywhere).

Imagery: local, hand-authored SVG illustrations
(`apps/web/src/assets/images`), not photographs — no image asset
pipeline exists in this codebase yet. Centralized in one barrel so
swapping in real production photography later touches that folder only.

## Folder contents (per FRONTEND_ARCHITECTURE.md §3.2 / §6.2)

- `components/` — module-owned UI, composing `@travelhub/ui` primitives.
  Only the sections `pages/HomePage.jsx` composes directly
  (Hero/FeaturedDestinations/FeaturedListings/PopularExperiences/
  Categories/WhyTravelHub/PartnerCta/Testimonials/Newsletter) are
  exported from `index.js`; every card component and the shared
  `SectionHeader`/`ScrollReveal`/`SearchWidget` building blocks stay
  module-private per §6.3's cross-module rule, promoted to `components/`
  or `@travelhub/ui` only once a second module needs one.
- `hooks/` — module-specific custom hooks (`useNewsletterSubscribe`)
- `queries/` — React Query query definitions (Ch. 14)
- `mutations/` — React Query mutation definitions (Ch. 14)
- `schemas/` — React Hook Form validation schemas (Ch. 15)
- `utils/` — module-specific pure helpers
- `constants/` — placeholder datasets and other structural (non-text)
  data; localized copy for all of it lives in translations under
  `home.*`, never hardcoded here
- `index.js` — this module's public export surface (Ch. 6.2) — the ONLY
  entry point other modules may import from (Ch. 6.3's cross-module rule)
