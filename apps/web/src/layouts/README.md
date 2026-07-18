# layouts

Chrome shared across a set of pages — header, footer, sidebar,
breadcrumbs, and a content outlet — `FRONTEND_ARCHITECTURE.md` §3.1/
Chapter 5. Seven named layouts are specified there (`PublicLayout`,
`AuthLayout`, `CustomerAccountLayout`, `PartnerLayout`, `AdminLayout`,
`CheckoutLayout`, `ErrorLayout`); only `PublicLayout` exists so far
(Sprint 1), refactored this sprint to compose the new `AppLayout` shell.

## AppLayout

Generic page-shell primitive — not one of the seven named layouts
itself, but the shared scaffold they all compose from: skip-link,
optional header slot, `<main>` landmark, optional footer slot. §5's own
framing ("Every layout is chrome only... never business logic")
describes exactly this shape, common to all seven; centralizing it here
is what satisfies this sprint's "no duplicated layout logic"
requirement.

**Props:** `header` (node, optional) · `footer` (node, optional) ·
`children` (node, required — the route outlet or other main content).

**Usage:**

```jsx
import { Outlet } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';
import Header from '../components/Header/Header.jsx';
import Footer from '../components/Footer/Footer.jsx';

export default function PublicLayout() {
  return (
    <AppLayout
      header={<Header logo="Travel Hub Armenia" />}
      footer={<Footer />}
    >
      <Outlet />
    </AppLayout>
  );
}
```

**Accessibility notes:** renders a real skip-to-content link
(translated via `a11y.skipToContent`) as the very first focusable
element, targeting `<main id="main-content" tabIndex={-1}>` — WCAG 2.4.1
Bypass Blocks. Router-agnostic on purpose (takes `children` rather than
rendering `<Outlet />` itself), so it works as a plain wrapper anywhere,
not only as a route element — the composing layout (e.g. `PublicLayout`)
is the one that knows about react-router.

## PublicLayout

Chrome for the Customer Website route tree (`FRONTEND_ARCHITECTURE.md`
§5.1). Composes `AppLayout` + `Header` + `Footer` with locale-aware nav
links (via `useParams()`'s `locale` segment). Still minimal relative to
the full §5.1 spec — sticky search, currency switcher, auth entry point,
real footer link columns, and mobile navigation are real content/
business decisions for a future sprint that has the modules/pages
needing them.
