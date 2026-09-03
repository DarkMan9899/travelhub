/**
 * usePointerParallax — normalized pointer offset (-1..1 on each axis)
 * relative to the center of the given element, for a subtle "layers
 * shift toward the cursor" spatial effect (Hero's depth scene). rAF-
 * throttled, like `useParallaxOffset`'s scroll listener. Inert under
 * `prefers-reduced-motion` (never attaches the listener) and on
 * coarse/touch pointers (a hover-driven effect has no touch equivalent,
 * and would otherwise just leave the offset stuck at whatever the last
 * touch happened to be).
 */

import { useEffect, useRef, useState } from 'react';
import useReducedMotion from './useReducedMotion.js';

export default function usePointerParallax(elementRef) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const prefersReducedMotion = useReducedMotion();
  const tickingRef = useRef(false);

  useEffect(() => {
    const node = elementRef.current;
    if (!node) return undefined;
    if (prefersReducedMotion) return undefined;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches
    ) {
      return undefined;
    }

    function handlePointerMove(event) {
      if (tickingRef.current) return;
      tickingRef.current = true;
      window.requestAnimationFrame(() => {
        const rect = node.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        setOffset({
          x: Math.max(-1, Math.min(1, x)),
          y: Math.max(-1, Math.min(1, y)),
        });
        tickingRef.current = false;
      });
    }

    function handlePointerLeave() {
      setOffset({ x: 0, y: 0 });
    }

    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerleave', handlePointerLeave);
    return () => {
      node.removeEventListener('pointermove', handlePointerMove);
      node.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [elementRef, prefersReducedMotion]);

  return offset;
}
