/**
 * Deterministic string → palette-index hash.
 *
 * Used by Avatar (COMPONENT_LIBRARY.md Part II §1) to pick a stable
 * fallback background color from a fixed palette, "deterministic...
 * derived from the user's ID, never a random color that would shift
 * between renders." Pure and framework-free so it is trivially unit
 * testable and reusable by any future component with the same need.
 */
export default function hashStringToIndex(value, paletteSize) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    // eslint-disable-next-line no-bitwise -- 32-bit hash mixing, the standard djb2-style pattern
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0; // eslint-disable-line no-bitwise
  }
  return Math.abs(hash) % paletteSize;
}
