import { useState, useEffect } from 'react';

/**
 * Detects a touch-only input device (no hover capability) via the
 * `(hover: none) and (pointer: coarse)` media query — used by Tooltip
 * (COMPONENT_LIBRARY.md Part II §1) to disable hover-triggered content
 * where hover has no meaning, and reusable by any future component with
 * the same need (FRONTEND_ARCHITECTURE.md §39's "extract shared logic"
 * rule).
 */
export default function useIsTouchOnlyDevice() {
  const [isTouchOnly, setIsTouchOnly] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;

    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    setIsTouchOnly(query.matches);

    const handleChange = (event) => setIsTouchOnly(event.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return isTouchOnly;
}
