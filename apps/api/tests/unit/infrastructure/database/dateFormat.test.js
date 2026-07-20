/**
 * `toDateString` must recover a MySQL `DATE` column's calendar date
 * regardless of the Node process's local timezone. `mysql2` constructs
 * the JS `Date` for a `DATE` column at LOCAL midnight (not UTC midnight);
 * a naive `.toISOString()` conversion rolls the date back by one day
 * whenever local time is ahead of UTC (e.g. Armenia Standard Time,
 * UTC+4 — this platform's own home timezone, and the exact environment
 * this bug was caught in during Sprint 10 verification).
 */

import { describe, test, expect } from '@jest/globals';
import { toDateString } from '../../../../src/infrastructure/database/dateFormat.js';

describe('toDateString', () => {
  test('passes a plain string through unchanged', () => {
    expect(toDateString('2026-07-12')).toBe('2026-07-12');
  });

  test('returns null/undefined unchanged', () => {
    expect(toDateString(null)).toBeNull();
    expect(toDateString(undefined)).toBeUndefined();
  });

  test('recovers the calendar date from a local-midnight Date object regardless of timezone', () => {
    // Constructing via new Date(year, monthIndex, day) always uses LOCAL
    // time semantics, exactly mirroring how mysql2 builds a DATE column's
    // JS Date — this must round-trip correctly no matter which timezone
    // the test happens to run in.
    const localMidnight = new Date(2026, 6, 12); // July 12, 2026, local midnight
    expect(toDateString(localMidnight)).toBe('2026-07-12');
  });

  test('does not roll back a date across a UTC+ahead timezone boundary', () => {
    // A Date whose UTC representation would read as the PREVIOUS day if
    // naively converted via toISOString() — the exact failure mode this
    // fix prevents.
    const localMidnightAheadOfUtc = new Date(2026, 0, 1); // Jan 1, local midnight
    const wrongWay = localMidnightAheadOfUtc.toISOString().slice(0, 10);
    const rightWay = toDateString(localMidnightAheadOfUtc);
    expect(rightWay).toBe('2026-01-01');
    // Only assert the two diverge when the test runner's own timezone is
    // actually ahead of UTC — this keeps the test meaningful without
    // being flaky on a UTC CI runner.
    if (new Date().getTimezoneOffset() < 0) {
      expect(wrongWay).not.toBe(rightWay);
    }
  });

  test('pads single-digit month and day with a leading zero', () => {
    expect(toDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
