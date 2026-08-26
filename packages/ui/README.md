# @desavii/ui

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

## Sprint 4 status (Layout System)

- **New `layout` group — `Container`, `Section`, `Page`, `Stack`,
  `Inline`, `Grid`, `Divider` implemented.** Not a `COMPONENT_LIBRARY.md`
  catalog group (its Part II has eight groups, none named "Layout") —
  these are zero-domain-knowledge structural primitives, which
  `FRONTEND_ARCHITECTURE.md` §3.1 defines as exactly what belongs in
  `ui/`, just not individually cataloged. See that group's own README
  for the full reasoning and per-component docs.
- **`navigation` group — `Breadcrumbs`, `Sidebar` implemented**,
  filling in two previously-scaffolded-only `COMPONENT_LIBRARY.md`
  entries ("Breadcrumb", "Sidebar Navigation").
- **New token file `tokens/_grid.scss`** — `UI_UX_GUIDELINES.docx` §5.3's
  responsive column/gutter/margin table, not present in
  `COMPONENT_LIBRARY.md`'s token digest.
- **New shared infra:** `mixins/_gap-scale.scss` and
  `utils/spacingScale.js` — the gap-based spacing scale used by `Stack`,
  `Inline`, and `Grid`, defined once rather than duplicated per
  component.
- **`Header`, `Footer`, `AppLayout` were built in `apps/web`, not here**
  — `FRONTEND_ARCHITECTURE.md` §3.1 explicitly assigns page chrome
  (header/footer/page-shell) to `apps/web/src/components/` and
  `src/layouts/`, not the framework-agnostic `ui/` design-system
  package. See `apps/web/src/components/README.md` and
  `apps/web/src/layouts/README.md`.
- No pages, business logic, authentication, or API/database work was
  touched — out of scope by design.

## Phase 5 status (Partner Listing Wizard primitives)

- **New `form-controls/DatePicker`, `listing-media/FileDropzone`,
  `navigation/WizardProgress` — implemented**, each with colocated
  `.module.scss`, unit tests, and full keyboard/ARIA support. Built to
  unblock `apps/web`'s `PartnerListingWizard` (Phase 5 — see the
  project's Phase 5 plan): a date-range picker for blackout dates, a
  drag-and-drop file input for the Media step, and a step indicator for
  the wizard shell.
- `listing-media` is a previously-empty scaffold group; `FileDropzone` is
  its first implemented component (and the group's own `index.js`/
  `package.json` export entry, added this phase). `WizardProgress` is not
  a `COMPONENT_LIBRARY.md` catalog entry — see `navigation/README.md`'s
  own section for the "uncataloged structural primitive" rationale
  already established by the `layout` group.
- No pages, business logic, authentication, or API/database work was
  touched — out of scope by design (primitives only, this phase's
  wizard _steps_ are separate `apps/web` work).

## Usage

Consuming apps import the token entry point once
(`@use '@desavii/ui/tokens' as tokens;`) and individual components from
their group:

```jsx
import {
  Button,
  Badge,
  Avatar,
  Tooltip,
} from '@desavii/ui/components/primitives';
import {
  Input,
  Select,
  DatePicker,
} from '@desavii/ui/components/form-controls';
import { Modal, Drawer, Alert } from '@desavii/ui/components/feedback-overlays';
import { Container, Page, Stack, Grid } from '@desavii/ui/components/layout';
import {
  Breadcrumbs,
  Sidebar,
  WizardProgress,
} from '@desavii/ui/components/navigation';
import { FileDropzone } from '@desavii/ui/components/listing-media';
```
