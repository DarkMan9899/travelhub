/**
 * Stack — vertical flex layout primitive.
 *
 * Not a COMPONENT_LIBRARY.md catalog entry — see packages/ui/README.md's
 * Sprint 4 section for why this whole `layout` group exists: a set of
 * zero-domain-knowledge structural primitives, which is exactly what
 * FRONTEND_ARCHITECTURE.md §3.1 defines `ui/` to hold, just not
 * individually named in COMPONENT_LIBRARY.md's component catalog.
 *
 * Polymorphic via `as` (e.g. `<Stack as="ul">`) so it can render
 * semantically correct HTML (a list, a nav, a section) instead of
 * always forcing a generic `<div>` — FRONTEND_ARCHITECTURE.md's
 * "Semantic HTML" accessibility rule.
 */

import PropTypes from 'prop-types';
import SPACING_SCALE from '../../../utils/spacingScale.js';
import styles from './Stack.module.scss';

const ALIGN_VALUES = ['stretch', 'flex-start', 'center', 'flex-end'];

export default function Stack({
  as: Component,
  gap,
  align,
  className,
  children,
  ...rest
}) {
  const classNames = [
    styles.stack,
    styles[`gap-${gap}`],
    styles[`align-${align}`],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // Polymorphic primitive: forwards arbitrary HTML attributes (id,
    // aria-*, onClick, data-*) to whatever element `as` resolves to.
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Component className={classNames} {...rest}>
      {children}
    </Component>
  );
}

Stack.propTypes = {
  as: PropTypes.elementType,
  gap: PropTypes.oneOf(SPACING_SCALE),
  align: PropTypes.oneOf(ALIGN_VALUES),
  className: PropTypes.string,
  children: PropTypes.node,
};

Stack.defaultProps = {
  as: 'div',
  gap: '4',
  align: 'stretch',
  className: undefined,
  children: undefined,
};

export { ALIGN_VALUES as STACK_ALIGN_VALUES };
