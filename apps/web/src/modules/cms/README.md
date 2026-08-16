# Module: cms

**Specification:** see `FRONTEND_ARCHITECTURE.md` Chapter 6 (Feature
Module Architecture) for this module's dependency rules, and the
corresponding `API_SPECIFICATION.md` module for the endpoints it will
consume.

**Phase 10 status:** static/info pages built — About, Contact, FAQ, Help
Center, Become a Partner, and a Blog "coming soon" placeholder. All
content is static, translated (en/hy/ru) copy; no CMS/database backs
this module (no queries/mutations exist here, deliberately).

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
