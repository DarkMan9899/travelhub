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

## Sprint 3 status (Feedback, Overlays & remaining primitives)

- **`primitives/Badge`, `Avatar`, `Tooltip` and `feedback-overlays/
Spinner`, `Skeleton`, `EmptyState`, `Alert`, `Modal`, `Drawer` —
  implemented**, each with colocated `.module.scss`, unit tests, and
  full keyboard/ARIA support. `Modal`/`Drawer` share their focus-trap,
  portal, and dismissal behaviour via a new `hooks/useFocusTrap.js` and
  a private `feedback-overlays/internal/Overlay` component, rather than
  duplicating it.
- `Alert` is not a `COMPONENT_LIBRARY.md` catalog entry — see that
  component's file header for why it was built anyway.
- `Button`'s loading-state spinner was refactored this sprint to reuse
  the new `feedback-overlays/Spinner` (in a `decorative` mode) instead
  of its own private copy — a cross-sprint DRY cleanup, not new scope.
- No pages, business logic, authentication, or API/database work was
  touched — out of scope by design.
- The remaining `COMPONENT_LIBRARY.md` Part II groups (Navigation, Data
  Display, Listing & Media, Booking & Payment, Dashboard) and the rest
  of `primitives`/`form-controls` (`Tag`, `Icon`, `DatePicker`,
  `TimePicker`, `SearchBar`) remain scaffolded only. `Select` (Sprint 2)
  already covers `COMPONENT_LIBRARY.md`'s merged "Select / Dropdown"
  catalog entry — no separate `Dropdown` component exists.

## Usage

Consuming apps import the token entry point once
(`@use '@travelhub/ui/tokens' as tokens;`) and individual components from
their group:

```jsx
import {
  Button,
  Badge,
  Avatar,
  Tooltip,
} from '@travelhub/ui/components/primitives';
import { Input, Select } from '@travelhub/ui/components/form-controls';
import {
  Modal,
  Drawer,
  Alert,
} from '@travelhub/ui/components/feedback-overlays';
```
