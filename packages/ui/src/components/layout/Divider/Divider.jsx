/**
 * Divider — thin rule separating content. See Stack.jsx's file header
 * for why this exists outside COMPONENT_LIBRARY.md's catalog.
 *
 * `horizontal` renders a native `<hr>` (implicit `role="separator"`,
 * horizontal by default) — the correct native element. `vertical` uses
 * `<hr>` too but for the browser to draw it correctly as a vertical rule
 * needs explicit sizing (width:1px/height:auto) driven by CSS alone;
 * semantically an `<hr role="separator" aria-orientation="vertical">`
 * is still valid per the ARIA spec (separator's orientation is
 * overridable), so no `<div>` substitution is needed either way.
 */

import PropTypes from 'prop-types';
import styles from './Divider.module.scss';

const ORIENTATIONS = ['horizontal', 'vertical'];

export default function Divider({ orientation, className }) {
  return (
    <hr
      aria-orientation={orientation}
      className={[styles.divider, styles[`divider--${orientation}`], className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}

Divider.propTypes = {
  orientation: PropTypes.oneOf(ORIENTATIONS),
  className: PropTypes.string,
};

Divider.defaultProps = {
  orientation: 'horizontal',
  className: undefined,
};

export { ORIENTATIONS as DIVIDER_ORIENTATIONS };
