/**
 * ScrollReveal — the `home` module's one shared scroll-reveal wrapper
 * (Framer Motion `whileInView`), reused by every homepage section instead
 * of each hand-rolling its own motion config. Renders a plain `<div>`
 * when `prefers-reduced-motion` is set (`useReducedMotion`,
 * FRONTEND_ARCHITECTURE.md §31), never animating in that case.
 *
 * `stagger`: when the children are a set of grid items (card grids),
 * each child gets its own `motion.div` with an incremental delay instead
 * of the whole group fading in as one block — reads meaningfully more
 * premium than a single blanket reveal. The outer element still carries
 * `className` (the grid layout class), so callers pass the same props
 * they already do for the non-staggered case.
 */

import { Children } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import useReducedMotion from '../../../../hooks/useReducedMotion.js';

const HIDDEN = { opacity: 0, y: 24 };
const VISIBLE = { opacity: 1, y: 0 };
// Mirrors tokens.$ease-out (packages/ui/src/tokens/_motion.scss) — SCSS
// variables aren't importable into JS, so the cubic-bezier is restated
// here rather than introducing a build-time token bridge for one value.
const EASE_OUT = [0, 0, 0.2, 1];
const STAGGER_STEP = 0.08;

export default function ScrollReveal({
  delay = 0,
  stagger = false,
  className = undefined,
  children,
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  if (stagger) {
    return (
      <div className={className}>
        {Children.map(children, (child, index) => (
          <motion.div
            key={child?.key ?? index}
            initial={HIDDEN}
            whileInView={VISIBLE}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.5,
              delay: delay + index * STAGGER_STEP,
              ease: EASE_OUT,
            }}
          >
            {child}
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={HIDDEN}
      whileInView={VISIBLE}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

ScrollReveal.propTypes = {
  delay: PropTypes.number,
  stagger: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};
