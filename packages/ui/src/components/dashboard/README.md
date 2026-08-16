# dashboard

**Phase 8 (Auth / User Dashboard) status:** `StatCard` implemented — the
Customer Dashboard's quick-stats tiles.

**Phase 9 (Partner Dashboard) status:** `ListingTableRow` implemented —
the Partner Dashboard's Listings Management row. Purely presentational
(no `react-i18next` import, matching every other component in this
folder): `statusBadge`/`typeBadge` are pre-rendered nodes and `actions`
is a free-form slot, since this domain's four listing states (DRAFT/
PUBLISHED/UNPUBLISHED/ARCHIVED) each have a different legal action set —
see the component's own header comment for why that replaces the
design doc's binary `onPublishToggle` prop. The remaining planned
components (Partner Calendar Editor, Moderation Queue Row, Audit Log
Viewer, Impersonation Banner, Employee List Item —
COMPONENT_LIBRARY.md Part II Section 8) are unimplemented; Partner
Calendar Editor implemented too — an always-open month grid reusing
`DatePicker`'s calendar-math helpers and grid/keyboard-navigation shape
(no popover chrome). `statusByDate` values are a small closed
`DAY_STATUS_VARIANTS` vocabulary (`available`/`blocked`/`booked`), not
raw backend status codes — the caller maps codes to variants, same
"variant not business logic" contract `Badge` uses. Price-override
editing (the design doc's popover) is deliberately out of this
component — no shared popover-editing primitive exists yet to build it
from; the consuming page builds that form itself from existing
`form-controls` primitives once a day/range is selected.

**Phase 11 (Admin Platform) status:** `DataTable` and `Chart` implemented.
`DataTable` is the first generic `Table`/list-with-columns primitive
anywhere in this package (every prior list page hand-rolled its own card
grid) — a real `<table>` for correct screen-reader semantics, columns
config + optional per-column `render`, and a cursor/"Load more" footer
matching this app's established pagination convention rather than the
existing-but-unused `Pagination` primitive. `Chart` is a thin wrapper
around `recharts` (the first charting dependency anywhere in this repo),
supporting exactly one bar/line time-series shape — extend it when a
second real chart shape is needed, not preemptively.

Each component, when implemented, follows the full specification in
`COMPONENT_LIBRARY.md` (Purpose, Props, States, Variants, Accessibility,
Animation, Responsive Behaviour, Dependencies, Where it is used) exactly
— one file per component, colocated with its `.module.scss`
(`FRONTEND_ARCHITECTURE.md` Section 9.1) and its own tests
(`FRONTEND_ARCHITECTURE.md` Section 35).
