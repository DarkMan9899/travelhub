/**
 * Shared `prefers-reduced-motion` check (FRONTEND_ARCHITECTURE.md §31:
 * "every Framer Motion animation... checks `prefers-reduced-motion` via a
 * shared hook"). One `matchMedia` subscription, reused by every animated
 * component instead of each reimplementing it.
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function getInitialPreference() {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia(QUERY).matches;
}

export default function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState(getInitialPreference);

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(QUERY);
    const handleChange = (event) => setPrefersReducedMotion(event.matches);

    mediaQueryList.addEventListener('change', handleChange);
    return () => mediaQueryList.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}
