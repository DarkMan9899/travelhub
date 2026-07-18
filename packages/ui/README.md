# @travelhub/ui

The shared design-system component library implementing
`COMPONENT_LIBRARY.md` and `UI_UX_GUIDELINES.md`. Consumed by `apps/web`
only (no server-side usage).

## Sprint 1 status

- **Design tokens (`src/tokens/`) — complete and validated.** Every
  value from `UI_UX_GUIDELINES.md` (colors, typography, spacing, radius,
  elevation, breakpoints, container widths, z-index, motion) plus the
  four sizing scales introduced in `COMPONENT_LIBRARY.md` Part I (icon,
  button, input, modal sizes) is implemented as a real, compiling SCSS
  module — verified to compile and resolve correctly during Sprint 1.
- **Shared mixins/functions (`src/mixins/`, `src/functions.scss`) —
  complete.** `respond()`, `focus-ring()`, `truncate-lines()`, `rem()` —
  the small set of helpers `FRONTEND_ARCHITECTURE.md` Section 9.3
  requires every component to use instead of hand-written media queries,
  focus styles, or unit conversions.
- **Components (`src/components/*`) — scaffolded, not implemented.**
  Eight group folders exist, matching `COMPONENT_LIBRARY.md` Part II
  exactly, each with a README naming its intended contents. No component
  logic ships in Sprint 1 — this is foundation only.

## Usage (once components exist)

Consuming apps import the token entry point once
(`@use '@travelhub/ui/tokens' as tokens;`) and individual components from
their group (`import { Button } from '@travelhub/ui/components/primitives';`).
