/**
 * Inline — horizontal flex layout primitive. See Stack.jsx's file
 * header for why this exists outside COMPONENT_LIBRARY.md's catalog.
 * Polymorphic via `as`, same rationale as Stack.
 */

import PropTypes from 'prop-types';
import SPACING_SCALE from '../../../utils/spacingScale.js';
import styles from './Inline.module.scss';

const ALIGN_VALUES = [
  'stretch',
  'flex-start',
  'center',
  'flex-end',
  'baseline',
];
const JUSTIFY_VALUES = [
  'flex-start',
  'center',
  'flex-end',
  'space-between',
  'space-around',
];

export default function Inline({
  as: Component,
  gap,
  align,
  justify,
  wrap,
  className,
  children,
  ...rest
}) {
  const classNames = [
    styles.inline,
    styles[`gap-${gap}`],
    styles[`align-${align}`],
    styles[`justify-${justify}`],
    wrap && styles.wrap,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // Polymorphic primitive: forwards arbitrary HTML attributes to
    // whatever element `as` resolves to, by design (see Stack.jsx).
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Component className={classNames} {...rest}>
      {children}
    </Component>
  );
}

Inline.propTypes = {
  as: PropTypes.elementType,
  gap: PropTypes.oneOf(SPACING_SCALE),
  align: PropTypes.oneOf(ALIGN_VALUES),
  justify: PropTypes.oneOf(JUSTIFY_VALUES),
  wrap: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

Inline.defaultProps = {
  as: 'div',
  gap: '4',
  align: 'center',
  justify: 'flex-start',
  wrap: true,
  className: undefined,
  children: undefined,
};

export {
  ALIGN_VALUES as INLINE_ALIGN_VALUES,
  JUSTIFY_VALUES as INLINE_JUSTIFY_VALUES,
};
