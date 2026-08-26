/**
 * @desavii/ui — public entry point.
 *
 * Sprint 2 shipped the eight UI Foundation components (Button, Input,
 * Textarea, Label, Checkbox, Radio, Switch, Select). Sprint 3 added
 * Badge, Avatar, Tooltip (primitives) and Spinner, Skeleton, EmptyState,
 * Alert, Modal, Drawer (feedback-overlays). Sprint 4 added the `layout`
 * group (Container, Section, Page, Stack, Inline, Grid, Divider — not a
 * COMPONENT_LIBRARY.md catalog group; see packages/ui/README.md's
 * Sprint 4 section) plus Breadcrumbs and Sidebar from the `navigation`
 * group. The Application Foundation phase added Toast/ErrorState
 * (feedback-overlays) and the first `data-display` components
 * (RatingStars, PriceTag). Phase 5 (Partner Listing Wizard) added
 * `DatePicker` (form-controls), `WizardProgress` (navigation), and the
 * first `listing-media` component, `FileDropzone`. Phase 9 (Partner
 * Dashboard) added the `dashboard` group (StatCard, ListingTableRow,
 * PartnerCalendarEditor) but only wired it into `package.json`'s
 * `exports` subpath, never into this root barrel — Phase 10 fixes that
 * omission below. Phase 10 also adds Icon/Card/Tag (primitives) and
 * Tabs/Pagination/Popover (navigation). Booking & Payment remains
 * unimplemented, no logic ships for it here.
 */

export * from './components/primitives/index.js';
export * from './components/form-controls/index.js';
export * from './components/feedback-overlays/index.js';
export * from './components/layout/index.js';
export * from './components/navigation/index.js';
export * from './components/data-display/index.js';
export * from './components/listing-media/index.js';
export * from './components/dashboard/index.js';
