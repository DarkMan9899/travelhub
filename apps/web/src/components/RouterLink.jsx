/**
 * Adapts `@travelhub/ui`'s router-agnostic `href` link contract
 * (`Breadcrumbs`/`Sidebar`'s own file headers: "always given an `href`
 * prop; a router link needs a small local adapter translating
 * `href` → `to`") to react-router-dom's `Link`. The one adapter every
 * consumer of those two components reuses, rather than each rewriting
 * it inline.
 */

import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';

export default function RouterLink({ href, ...rest }) {
  // Forwards arbitrary props (className, aria-current, children, ...)
  // straight through to react-router's Link — same rationale as the
  // ui/ layout primitives' own polymorphic `as` spreading.
  // eslint-disable-next-line react/jsx-props-no-spreading
  return <Link to={href} {...rest} />;
}

RouterLink.propTypes = {
  href: PropTypes.string.isRequired,
};
