/**
 * useTiltEffect — a small, reusable pointer-tilt for individual cards
 * (Categories' bento grid; anywhere a bounded, small set of cards wants
 * its own hover tilt rather than Showcase.jsx's one-delegated-listener
 * version for an Embla row). Writes two CSS custom properties
 * (`--tilt-x`/`--tilt-y`, -1..1) straight to the DOM node via a ref —
 * never React state, so a fast mousemove stream never triggers a
 * re-render — and leaves the actual `rotateX`/`rotateY` transform
 * formula to the caller's own stylesheet (so it composes with that
 * element's existing hover transform instead of an inline style
 * overriding it outright). Returns the three event handlers to spread
 * onto the tilting element; does nothing under `prefers-reduced-motion`
 * or a coarse/touch pointer, where a hover-driven tilt has no
 * equivalent gesture.
 */

import { useMemo, useRef } from 'react';
import useReducedMotion from './useReducedMotion.js';

export default function useTiltEffect() {
  const nodeRef = useRef(null);
  const rafRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const isCoarsePointer =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(pointer: coarse)').matches;
  const disabled = prefersReducedMotion || isCoarsePointer;

  return useMemo(() => {
    if (disabled) {
      return {
        ref: nodeRef,
        onPointerMove: undefined,
        onPointerLeave: undefined,
      };
    }

    function handlePointerMove(event) {
      const node = nodeRef.current;
      if (!node) return;
      if (rafRef.current !== null) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        const rect = node.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        node.style.setProperty('--tilt-x', x.toFixed(3));
        node.style.setProperty('--tilt-y', y.toFixed(3));
      });
    }

    function handlePointerLeave() {
      const node = nodeRef.current;
      if (!node) return;
      node.style.setProperty('--tilt-x', '0');
      node.style.setProperty('--tilt-y', '0');
    }

    return {
      ref: nodeRef,
      onPointerMove: handlePointerMove,
      onPointerLeave: handlePointerLeave,
    };
  }, [disabled]);
}
