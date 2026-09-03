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
 *
 * `variant` (redesign phase, 2026 — page-wide scroll/depth system):
 * `'fade'` (default) is the original plain fade-up, unchanged for every
 * existing call site. `'depth'` additionally scales up from slightly
 * smaller and un-blurs as it settles — reads as the section genuinely
 * emerging out of the scene's depth rather than just fading into place,
 * the brief's explicit "text entering from depth rather than simple
 * fade-up everywhere." Kept to two variants (not one per section) so the
 * page still reads as "part of one system," per the brief's own framing,
 * rather than a different bespoke animation per section.
 *
 * `skipInitialHide` (2026 SEO/performance audit): real Lighthouse trace
 * evidence identified the Home hero's `<h1>` — wrapped in this component
 * — as the page's LCP element, with Render Delay alone accounting for
 * 92% of a 5.6s LCP. `whileInView`'s `initial={hidden}` (opacity 0) means
 * an above-the-fold element that's visible without any scroll still
 * waits on an IntersectionObserver round-trip plus the full transition
 * duration before it's even paintable — actively counterproductive for
 * content the user sees immediately. This flag renders that one instance
 * already visible from first paint (reusing the exact same "just a plain
 * wrapper, no animation" path `prefersReducedMotion` already takes)
 * while every sibling `ScrollReveal` around it (eyebrow, subtitle, CTAs)
 * keeps its own entrance untouched — the multi-beat sequence still
 * reads, just without gating the one element that's also a Core Web
 * Vital behind it.
 */

import { Children } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import useReducedMotion from '../../../../hooks/useReducedMotion.js';

const VARIANTS = {
  fade: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
  },
  depth: {
    hidden: { opacity: 0, y: 36, scale: 0.94, filter: 'blur(6px)' },
    visible: { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' },
  },
};
// Mirrors tokens.$ease-out (packages/ui/src/tokens/_motion.scss) — SCSS
// variables aren't importable into JS, so the cubic-bezier is restated
// here rather than introducing a build-time token bridge for one value.
const EASE_OUT = [0, 0, 0.2, 1];
const STAGGER_STEP = 0.08;

export default function ScrollReveal({
  delay = 0,
  stagger = false,
  variant = 'fade',
  className = undefined,
  // Forwarded straight through to the rendered element — Hero.jsx's
  // pointer-parallax offset is a continuously-varying JS-computed value,
  // the same reason other parallax layers in this app use an inline
  // `style.transform` rather than a CSS class.
  style = undefined,
  skipInitialHide = false,
  children,
}) {
  const prefersReducedMotion = useReducedMotion();
  const { hidden, visible } = VARIANTS[variant];
  // `depth`'s blur/scale reads as noticeably more expensive motion than a
  // plain fade — a slightly longer settle duration keeps it from feeling
  // rushed/glitchy, still well inside a single comfortable scroll pause.
  const duration = variant === 'depth' ? 0.7 : 0.5;

  if (prefersReducedMotion || skipInitialHide) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  if (stagger) {
    return (
      <div className={className} style={style}>
        {Children.map(children, (child, index) => (
          <motion.div
            key={child?.key ?? index}
            initial={hidden}
            whileInView={visible}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration,
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
      style={style}
      initial={hidden}
      whileInView={visible}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration, delay, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

ScrollReveal.propTypes = {
  delay: PropTypes.number,
  stagger: PropTypes.bool,
  variant: PropTypes.oneOf(Object.keys(VARIANTS)),
  className: PropTypes.string,
  // Forwarded as-is to the rendered element, the same "caller owns the
  // shape" contract `className` already has here.
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.object,
  skipInitialHide: PropTypes.bool,
  children: PropTypes.node.isRequired,
};
