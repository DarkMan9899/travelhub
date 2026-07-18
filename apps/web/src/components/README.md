# components

Composite components shared across more than one module or layout, but
too domain-specific for `@travelhub/ui` — `FRONTEND_ARCHITECTURE.md`
§3.1: "shared across more than one module but too domain-specific for
`ui/`" (e.g. `PriceBreakdown`, `ListingCard`). `Header` and `Footer`
below are this sprint's first inhabitants: `PublicLayout` uses the full
header, `CustomerAccountLayout` uses "a condensed version of
PublicLayout's header" (§5.3) — built once here, composed with
different `navItems`/`actions` per layout, per this sprint's "no
duplicated layout logic" requirement.

Both carry **zero business logic** (no auth state, no API calls,
no hardcoded content) — every piece of real content (`logo`, `navItems`,
`actions`, footer `columns`) is supplied by whichever layout composes
them.

## Header

**Props:** `logo` (node, required) · `homeHref` (string, default `'/'`)
· `navItems` (array of `{ label, to }`, default `[]`) · `actions`
(node, optional — a slot for auth/language-switcher controls).

**Usage:**

```jsx
import Header from '../components/Header/Header.jsx';

<Header
  logo="Travel Hub Armenia"
  homeHref="/hy"
  navItems={[
    { label: 'Home', to: '/hy' },
    { label: 'Search', to: '/hy/search' },
  ]}
/>;
```

**Accessibility notes:** renders `<header>` (the `banner` landmark) with
a `<nav aria-label="Primary">` for `navItems` — omitted entirely (no
empty landmark) when `navItems` is empty. Every link meets the 44px
minimum touch-target height. Uses `@travelhub/ui`'s `focus-ring()` mixin
throughout.

## Footer

**Props:** `columns` (array of `{ title, links: [{ label, to }] }`,
default `[]`) · `bottomText` (string, optional — e.g. a copyright line).

**Usage:**

```jsx
import Footer from '../components/Footer/Footer.jsx';

<Footer
  columns={[{ title: 'Company', links: [{ label: 'About', to: '/about' }] }]}
  bottomText="© 2026 Travel Hub Armenia"
/>;
```

**Accessibility notes:** renders `<footer>` (the `contentinfo`
landmark); each column is its own `<nav aria-label={column.title}>`
landmark, so screen-reader users can jump directly to "Company",
"Support", etc. Omitted entirely (no empty grid) when `columns` is
empty.
