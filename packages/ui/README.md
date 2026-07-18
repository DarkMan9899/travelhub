# @travelhub/ui

The shared design-system component library implementing
`COMPONENT_LIBRARY.md` and `UI_UX_GUIDELINES.md`. Consumed by `apps/web`
only (no server-side usage).

## Sprint 1 status (Foundation)

- **Design tokens (`src/tokens/`) — complete and validated.** Every
  value from `UI_UX_GUIDELINES.md` (colors, typography, spacing, radius,
  elevation, breakpoints, container widths, z-index, motion) plus the
  four sizing scales introduced in `COMPONENT_LIBRARY.md` Part I (icon,
  button, input, modal sizes) is implemented as a real, compiling SCSS
  module.
- **Shared mixins/functions (`src/mixins/`, `src/functions.scss`) —
  complete.** `respond()`, `focus-ring()`, `truncate-lines()`, `rem()` —
  the small set of helpers `FRONTEND_ARCHITECTURE.md` Section 9.3
  requires every component to use instead of hand-written media queries,
  focus styles, or unit conversions.

## Sprint 2 status (UI Foundation components)

- **`primitives/Button` and all seven `form-controls` components
  (`Label`, `Input`, `Textarea`, `Checkbox`, `Radio`, `Switch`,
  `Select`) — implemented,** each with colocated `.module.scss`, unit
  tests (React Testing Library + Vitest), and full keyboard/ARIA
  support per `COMPONENT_LIBRARY.md`. See each group's own README for
  usage examples and any documented deviations from the spec.
- No pages, business logic, authentication, or API/database work was
  touched this sprint — out of scope by design (UI Foundation only).
- The remaining six `COMPONENT_LIBRARY.md` Part II groups (Navigation,
  Feedback & Overlays, Data Display, Listing & Media, Booking &
  Payment, Dashboard) and the rest of `primitives`/`form-controls`
  (`Badge`, `Tag`, `Avatar`, `Tooltip`, `Icon`, `DatePicker`,
  `TimePicker`, `SearchBar`) remain scaffolded only.

## Usage

Consuming apps import the token entry point once
(`@use '@travelhub/ui/tokens' as tokens;`) and individual components from
their group:

```jsx
import { Button } from '@travelhub/ui/components/primitives';
import { Input, Select } from '@travelhub/ui/components/form-controls';
```
