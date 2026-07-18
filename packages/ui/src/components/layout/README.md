# layout

**Sprint 4 status:** `Container`, `Section`, `Page`, `Stack`, `Inline`,
`Grid`, `Divider` implemented.

Not a `COMPONENT_LIBRARY.md` Part II catalog group — the catalog's eight
groups don't include a "Layout" section. These are zero-domain-knowledge
structural primitives, which is exactly what `FRONTEND_ARCHITECTURE.md`
§3.1 defines the `ui/` layer to hold ("pure design-system primitives...
with zero business/domain knowledge"); they just aren't individually
named in `COMPONENT_LIBRARY.md`. See `packages/ui/README.md`'s Sprint 4
section for the full placement reasoning (why these live here and not in
`apps/web/src/layouts/` or `src/components/`).

All seven are polymorphic via an `as` prop (except `Divider`, which is
always a native `<hr>`) and forward arbitrary HTML attributes
(`id`, `aria-*`, `onClick`, `data-*`, ...) to whatever element `as`
resolves to — so each can render the semantically correct element for
its context (`<ul>`, `<nav>`, `<main>`, ...) rather than always a `<div>`.

## Container

Max-width, centered content wrapper. Maps to `COMPONENT_LIBRARY.md` Part
I's Container Widths token table.

**Props:** `as` (element type, default `'div'`) · `size`
(`'content'` 1200px / `'wide'` 1440px / `'narrow'` 720px / `'full'`
100%, default `'content'`) · `className` · `children` · ...rest
(forwarded to the underlying element).

**Usage:**

```jsx
import { Container } from '@travelhub/ui/components/layout';

<Container size="wide">{/* dashboard-width content */}</Container>;
```

**Accessibility notes:** purely structural — carries no role or ARIA of
its own. Uses `margin-inline`/`padding-inline` (logical properties), so
it flips correctly under `dir="rtl"` with no separate RTL styles.

## Section

Vertical-rhythm page region. Implements `UI_UX_GUIDELINES.docx` §5.4:
"Vertical rhythm between sections is always space-16 (mobile) or
space-24 (desktop) — never arbitrary."

**Props:** `as` (default `'section'`) · `spacing` (`'default'` | `'none'`
— closed, not arbitrary, per the rule above) · `className` · `children`
· ...rest.

**Usage:**

```jsx
import { Section } from '@travelhub/ui/components/layout';

<Section aria-label="Featured listings">{/* ... */}</Section>;
```

**Accessibility notes:** a `<section>` is only exposed as a landmark
region once it has an accessible name — pass `aria-label` or
`aria-labelledby` when it should be a distinct landmark; otherwise it's
a plain grouping element (still valid, just not a landmark).

## Page

Top-level per-route content wrapper. Composes `Container` (no
duplicated centering logic).

**Props:** `title` (string, optional — renders the page's single
`<h1>`) · `containerSize` (same values as `Container`'s `size`, default
`'content'`) · `className` · `children`.

**Usage:**

```jsx
import { Page } from '@travelhub/ui/components/layout';

<Page title="Search results">{/* results list */}</Page>;
```

**Accessibility notes:** `title`, when given, is the page's `<h1>` — one
per page. The surrounding `<main>` landmark is `AppLayout`'s
responsibility (`apps/web/src/layouts/AppLayout.jsx`), not this
component's — `Page` is a content-level wrapper, not a landmark.

## Stack / Inline

`Stack` (vertical flex) and `Inline` (horizontal flex, wraps by
default). Both draw their `gap` from the same spacing scale, defined
once in `mixins/_gap-scale.scss` and `utils/spacingScale.js`.

**`Stack` props:** `as` (default `'div'`) · `gap` (spacing-scale key:
`'0'|'1'|'2'|'3'|'4'|'6'|'8'|'12'|'16'|'24'`, default `'4'`) · `align`
(`'stretch'|'flex-start'|'center'|'flex-end'`, default `'stretch'`) ·
`className` · `children` · ...rest.

**`Inline` props:** as `Stack`, plus `justify`
(`'flex-start'|'center'|'flex-end'|'space-between'|'space-around'`,
default `'flex-start'`) and `wrap` (boolean, default `true`); `align`
also accepts `'baseline'`.

**Usage:**

```jsx
import { Stack, Inline } from '@travelhub/ui/components/layout';

<Stack as="ul" gap="2" aria-label="Amenities">
  <li>Wi-Fi</li>
  <li>Pool</li>
</Stack>

<Inline gap="3" justify="space-between">
  <span>Price</span>
  <strong>$120</strong>
</Inline>
```

**Accessibility notes:** purely structural. `as="ul"`/`as="ol"` renders
a real list — pair with `<li>` children for correct list semantics.

## Grid

CSS Grid layout primitive. `columns="auto"` (default) follows
`UI_UX_GUIDELINES.docx` §5.3's responsive column table (4 → 8 → 12
columns by breakpoint, via `tokens/_grid.scss`). A fixed `columns`
number pins the column count at every breakpoint instead.

**Props:** `as` (default `'div'`) · `columns` (`'auto'` | number,
default `'auto'`) · `gap` (spacing-scale key, default `'4'`) ·
`className` · `style` · `children` · ...rest.

**Usage:**

```jsx
import { Grid } from '@travelhub/ui/components/layout';

<Grid columns="auto" gap="6">
  {/* responsive 4/8/12-column grid */}
</Grid>

<Grid columns={3} gap="4">
  {/* always-3-up card grid */}
</Grid>
```

**Accessibility notes:** purely structural; visual order should always
match DOM/reading order (no CSS Grid reordering that would create a
mismatch between visual and screen-reader/keyboard navigation order).

## Divider

Thin rule separator. Always a native `<hr>` (implicit
`role="separator"`).

**Props:** `orientation` (`'horizontal'|'vertical'`, default
`'horizontal'`) · `className`.

**Usage:**

```jsx
import { Divider } from '@travelhub/ui/components/layout';

<Divider />
<Divider orientation="vertical" />
```

**Accessibility notes:** `aria-orientation` is set explicitly for both
orientations (redundant but harmless for the horizontal default, since
`separator`'s ARIA default orientation is already horizontal).
