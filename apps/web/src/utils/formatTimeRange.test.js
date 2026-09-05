import { describe, test, expect } from 'vitest';
import { formatTimeRange } from './formatTimeRange.js';

describe('formatTimeRange', () => {
  test('formats a start/end pair with an en dash', () => {
    expect(formatTimeRange('09:00', '11:30')).toBe('09:00–11:30');
  });

  test('falls back to the start time alone when there is no end time', () => {
    expect(formatTimeRange('09:00', null)).toBe('09:00');
    expect(formatTimeRange('09:00', undefined)).toBe('09:00');
  });

  test('returns null when there is no start time at all', () => {
    expect(formatTimeRange(null, null)).toBeNull();
    expect(formatTimeRange(undefined, '11:30')).toBeNull();
  });
});
