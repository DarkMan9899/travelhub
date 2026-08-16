/**
 * Card — the platform's one surface/container primitive (elevation-0
 * flat card per `UI_UX_GUIDELINES.md` §6.2). `as` lets a card render as
 * a real link (`ListingCardBase.jsx`'s `as={RouterLink} href={...}`)
 * rather than a `<div>` wrapping an inner link, so the whole card stays
 * one focusable, keyboard-activatable element.
 */

import PropTypes from 'prop-types';
import styles from './Card.module.scss';

const PADDING_VALUES = ['none', 'sm', 'md', 'lg'];

export default function Card({
  as: Component = 'div',
  padding = 'md',
  interactive = false,
  className = undefined,
  children = undefined,
  ...rest
}) {
  const combinedClassName = [
    styles.card,
    styles[`card--padding-${padding}`],
    interactive && styles['card--interactive'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading -- forwards `href`/`to`/`aria-*`/`onClick`, whose exact set depends on the polymorphic `as` element
    <Component className={combinedClassName} {...rest}>
      {children}
    </Component>
  );
}

Card.propTypes = {
  as: PropTypes.elementType,
  padding: PropTypes.oneOf(PADDING_VALUES),
  interactive: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export { PADDING_VALUES as CARD_PADDING_VALUES };
