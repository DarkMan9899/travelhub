/**
 * Grid — CSS Grid layout primitive. See Stack.jsx's file header for why
 * this exists outside COMPONENT_LIBRARY.md's catalog.
 *
 * `columns="auto"` (default) follows UI_UX_GUIDELINES.docx §5.3's
 * responsive column table (4 columns on Mobile/Mobile-Large, 8 on
 * Tablet, 12 on Laptop/Desktop) via `tokens/_grid.scss`. Passing a fixed
 * `columns` number instead pins the column count at every breakpoint
 * (e.g. a 3-up card grid) — set through a scoped CSS custom property,
 * since an arbitrary integer can't be pre-enumerated as a token class
 * the way the spacing scale can.
 */

import PropTypes from 'prop-types';
import SPACING_SCALE from '../../../utils/spacingScale.js';
import styles from './Grid.module.scss';

export default function Grid({
  as: Component,
  columns,
  gap,
  className,
  style,
  children,
  ...rest
}) {
  const isFixed = columns !== 'auto';
  const classNames = [
    styles.grid,
    styles[`gap-${gap}`],
    isFixed ? styles['grid--fixed'] : styles['grid--auto'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedStyle = isFixed ? { '--grid-columns': columns, ...style } : style;

  return (
    // Polymorphic primitive: forwards arbitrary HTML attributes to
    // whatever element `as` resolves to, by design (see Stack.jsx).
    // eslint-disable-next-line react/jsx-props-no-spreading
    <Component className={classNames} style={mergedStyle} {...rest}>
      {children}
    </Component>
  );
}

Grid.propTypes = {
  as: PropTypes.elementType,
  columns: PropTypes.oneOfType([PropTypes.oneOf(['auto']), PropTypes.number]),
  gap: PropTypes.oneOf(SPACING_SCALE),
  className: PropTypes.string,
  // Passthrough to the underlying element's native `style`, merged with
  // the internal --grid-columns custom property; shape is caller-defined.
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.object,
  children: PropTypes.node,
};

Grid.defaultProps = {
  as: 'div',
  columns: 'auto',
  gap: '4',
  className: undefined,
  style: undefined,
  children: undefined,
};
