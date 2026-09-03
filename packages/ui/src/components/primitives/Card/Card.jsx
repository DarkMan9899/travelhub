/**
 * Card — the platform's one surface/container primitive (elevation-0
 * flat card per `UI_UX_GUIDELINES.md` §6.2). `as` lets a card render as
 * a real link (`ListingCardBase.jsx`'s `as={RouterLink} href={...}`)
 * rather than a `<div>` wrapping an inner link, so the whole card stays
 * one focusable, keyboard-activatable element.
 *
 * `elevated` (redesign phase, 2026) opts a card into the premium
 * "floating surface" treatment (tokens.elevation-4, no border, a
 * stronger lift-on-hover) — deliberately a separate opt-in prop rather
 * than folding it into `interactive`, since not every interactive card
 * on the platform should read as a floating premium surface (an admin
 * table row card, for instance, should not) — this is reserved for the
 * public-journey surfaces the redesign brief calls out (listing/search
 * cards, the sticky booking card, hero-adjacent panels).
 */

import PropTypes from 'prop-types';
import styles from './Card.module.scss';

const PADDING_VALUES = ['none', 'sm', 'md', 'lg'];

export default function Card({
  as: Component = 'div',
  padding = 'md',
  interactive = false,
  elevated = false,
  className = undefined,
  children = undefined,
  ...rest
}) {
  const combinedClassName = [
    styles.card,
    styles[`card--padding-${padding}`],
    interactive && styles['card--interactive'],
    elevated && styles['card--elevated'],
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
  elevated: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};

export { PADDING_VALUES as CARD_PADDING_VALUES };
