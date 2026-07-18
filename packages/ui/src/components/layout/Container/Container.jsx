/**
 * Container — max-width, centered content wrapper. See Stack.jsx's file
 * header for why this exists outside COMPONENT_LIBRARY.md's catalog.
 * `size` maps directly to COMPONENT_LIBRARY.md Part I's Container
 * Widths token table (Content/Wide/Narrow/Full Bleed).
 */

import PropTypes from 'prop-types';
import styles from './Container.module.scss';

const SIZES = ['content', 'wide', 'narrow', 'full'];

export default function Container({
  as: Component,
  size,
  className,
  children,
  ...rest
}) {
  const classNames = [styles.container, styles[`container--${size}`], className]
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

Container.propTypes = {
  as: PropTypes.elementType,
  size: PropTypes.oneOf(SIZES),
  className: PropTypes.string,
  children: PropTypes.node,
};

Container.defaultProps = {
  as: 'div',
  size: 'content',
  className: undefined,
  children: undefined,
};

export { SIZES as CONTAINER_SIZES };
