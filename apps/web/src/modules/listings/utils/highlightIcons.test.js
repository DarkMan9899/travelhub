import { describe, test, expect } from 'vitest';
import resolveHighlightIcon, {
  HIGHLIGHT_ICON_CODES,
} from './highlightIcons.js';

describe('highlightIcons', () => {
  test('resolves a known code to its icon component', () => {
    expect(resolveHighlightIcon('wifi')).toBeDefined();
  });

  test('resolves an unknown code to the generic fallback icon', () => {
    const fallback = resolveHighlightIcon('__not_a_real_code__');
    expect(fallback).toBeDefined();
    // Two unrelated known codes should each resolve to something different
    // from the fallback — proves the fallback isn't accidentally shared by
    // the whole map.
    expect(resolveHighlightIcon('wifi')).not.toBe(fallback);
  });

  test('HIGHLIGHT_ICON_CODES is a non-empty, de-duplicated list of every valid code', () => {
    expect(HIGHLIGHT_ICON_CODES.length).toBeGreaterThan(0);
    expect(new Set(HIGHLIGHT_ICON_CODES).size).toBe(
      HIGHLIGHT_ICON_CODES.length,
    );
    expect(HIGHLIGHT_ICON_CODES).toContain('wifi');
    expect(HIGHLIGHT_ICON_CODES).toContain('pool');
  });

  test('every code in HIGHLIGHT_ICON_CODES resolves to a real (non-fallback) icon', () => {
    const fallback = resolveHighlightIcon('__not_a_real_code__');
    HIGHLIGHT_ICON_CODES.forEach((code) => {
      expect(resolveHighlightIcon(code)).not.toBe(fallback);
    });
  });
});
