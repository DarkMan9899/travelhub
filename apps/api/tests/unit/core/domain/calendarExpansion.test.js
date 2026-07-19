/**
 * Sprint 9 (redesigned): `expandCalendarDays` merges real
 * `availability_calendar` statuses (`calendarByDate`, default
 * `AVAILABLE` where no row exists) with the complementary `blackout_
 * dates` veto (`blockedRanges`, which always wins). `enumerateDates` is
 * the shared date-range primitive both this function and the calendar
 * repository's range-write path use.
 */

import { describe, test, expect } from '@jest/globals';
import {
  enumerateDates,
  expandCalendarDays,
} from '../../../../src/core/domain/calendarExpansion.js';

describe('enumerateDates', () => {
  test('every day is AVAILABLE when there is no calendar data or blackout', () => {
    const days = expandCalendarDays('2026-08-01', '2026-08-03');
    expect(days).toEqual([
      { date: '2026-08-01', status: 'AVAILABLE' },
      { date: '2026-08-02', status: 'AVAILABLE' },
      { date: '2026-08-03', status: 'AVAILABLE' },
    ]);
  });

  test('returns every YYYY-MM-DD date inclusive, crossing a month boundary', () => {
    expect(enumerateDates('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  test('a single-day span returns exactly one date', () => {
    expect(enumerateDates('2026-08-01', '2026-08-01')).toEqual(['2026-08-01']);
  });

  test('throws when from is after to', () => {
    expect(() => enumerateDates('2026-08-05', '2026-08-01')).toThrow(
      RangeError,
    );
  });
});

describe('expandCalendarDays', () => {
  test('a calendar row marks its date with that status', () => {
    const days = expandCalendarDays('2026-08-01', '2026-08-03', {
      calendarByDate: { '2026-08-02': 'BLOCKED' },
    });
    expect(days.map((d) => d.status)).toEqual([
      'AVAILABLE',
      'BLOCKED',
      'AVAILABLE',
    ]);
  });

  test('a blackout veto forces BLOCKED even when the calendar says AVAILABLE', () => {
    const days = expandCalendarDays('2026-08-01', '2026-08-03', {
      calendarByDate: { '2026-08-02': 'AVAILABLE' },
      blockedRanges: [{ dateFrom: '2026-08-02', dateTo: '2026-08-02' }],
    });
    expect(days.map((d) => d.status)).toEqual([
      'AVAILABLE',
      'BLOCKED',
      'AVAILABLE',
    ]);
  });

  test('a blackout veto applies even to a date with no calendar row at all', () => {
    const days = expandCalendarDays('2026-08-01', '2026-08-03', {
      blockedRanges: [{ dateFrom: '2026-08-01', dateTo: '2026-08-03' }],
    });
    expect(days.every((d) => d.status === 'BLOCKED')).toBe(true);
  });

  test('blackout and calendar sources combine correctly across a span', () => {
    const days = expandCalendarDays('2026-08-01', '2026-08-05', {
      calendarByDate: { '2026-08-01': 'BLOCKED', '2026-08-03': 'AVAILABLE' },
      blockedRanges: [{ dateFrom: '2026-08-04', dateTo: '2026-08-04' }],
    });
    expect(days.map((d) => d.status)).toEqual([
      'BLOCKED', // explicit calendar row
      'AVAILABLE', // default, no row
      'AVAILABLE', // explicit calendar row
      'BLOCKED', // blackout veto, no calendar row
      'AVAILABLE', // default, no row
    ]);
  });

  test('throws when from is after to, rather than silently returning nothing', () => {
    expect(() => expandCalendarDays('2026-08-05', '2026-08-01')).toThrow(
      RangeError,
    );
  });
});
