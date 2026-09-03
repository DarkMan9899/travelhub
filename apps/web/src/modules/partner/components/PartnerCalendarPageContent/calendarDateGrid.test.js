import { describe, test, expect } from 'vitest';
import {
  addDays,
  startOfWeek,
  weekDates,
  HOUR_ROWS,
  timeToRowOffset,
} from './calendarDateGrid.js';

describe('calendarDateGrid (apps/web/src/modules/partner)', () => {
  test('addDays is UTC-anchored and never drifts across a day boundary regardless of local timezone', () => {
    expect(addDays('2026-03-01', 1)).toBe('2026-03-02');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  test('startOfWeek resolves to the Monday of the ISO week for every weekday', () => {
    expect(startOfWeek('2026-03-02')).toBe('2026-03-02');
    expect(startOfWeek('2026-03-08')).toBe('2026-03-02');
    expect(startOfWeek('2026-03-01')).toBe('2026-02-23');
  });

  test('weekDates returns 7 consecutive ISO dates starting from the given Monday', () => {
    expect(weekDates('2026-03-02')).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
  });

  test('HOUR_ROWS spans 06:00-23:00 inclusive', () => {
    expect(HOUR_ROWS[0]).toBe('06:00');
    expect(HOUR_ROWS[HOUR_ROWS.length - 1]).toBe('23:00');
    expect(HOUR_ROWS).toHaveLength(18);
  });

  test('timeToRowOffset maps a time onto the hour axis, clamped to its bounds', () => {
    expect(timeToRowOffset('06:00')).toBe(0);
    expect(timeToRowOffset('09:30')).toBe(3.5);
    expect(timeToRowOffset('23:00')).toBe(17);
    expect(timeToRowOffset('02:00')).toBe(0);
    expect(timeToRowOffset('23:59')).toBeLessThanOrEqual(18);
  });
});
