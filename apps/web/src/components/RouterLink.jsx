/**
 * Adapts `@desavii/ui`'s router-agnostic `href` link contract
 * (`Breadcrumbs`/`Sidebar`'s own file headers: "always given an `href`
 * prop; a router link needs a small local adapter translating
 * `href` → `to`") to react-router-dom's `Link`. The one adapter every
 * consumer of those two components reuses, rather than each rewriting
 * it inline.
 *
 * `forwardRef` (redesign phase, 2026) — `CategoryCard`'s own pointer-tilt
 * (`useTiltEffect`) needs a real DOM node ref on the rendered `<a>` to
 * write its `--tilt-x`/`--tilt-y` custom properties to; a plain function
 * component silently drops a `ref` prop instead of forwarding it. Purely
 * additive — every existing caller that never passes `ref` is unaffected.
 */

import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

const RouterLink = forwardRef(function RouterLink({ href, ...rest }, ref) {
  // Forwards arbitrary props (className, aria-current, children, ...)
  // straight through to react-router's Link — same rationale as the
  // ui/ layout primitives' own polymorphic `as` spreading.
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Link ref={ref} to={href} {...rest} />;
});

RouterLink.propTypes = {
  href: PropTypes.string.isRequired,
};

export default RouterLink;
