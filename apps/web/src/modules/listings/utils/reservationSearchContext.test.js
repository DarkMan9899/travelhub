import { describe, test, expect } from 'vitest';
import { resolveInitialReservationState } from './reservationSearchContext.js';

const TODAY = '2026-09-01';

function params(query) {
  return new URLSearchParams(query);
}

describe('resolveInitialReservationState', () => {
  test('resolves a valid future dateFrom/dateTo/guests triple', () => {
    const result = resolveInitialReservationState(
      params('dateFrom=2026-09-10&dateTo=2026-09-12&guests=3'),
      TODAY,
    );
    expect(result).toEqual({
      dateRange: { start: '2026-09-10', end: '2026-09-12' },
      guestCount: 3,
    });
  });

  test('defaults to blank dates and guests=1 with no params at all (bare listing URL)', () => {
    const result = resolveInitialReservationState(params(''), TODAY);
    expect(result).toEqual({
      dateRange: { start: null, end: null },
      guestCount: 1,
    });
  });

  test('rejects a dateFrom before today', () => {
    const result = resolveInitialReservationState(
      params('dateFrom=2020-01-01&dateTo=2020-01-03'),
      TODAY,
    );
    expect(result.dateRange).toEqual({ start: null, end: null });
  });

  test('rejects dateTo before dateFrom', () => {
    const result = resolveInitialReservationState(
      params('dateFrom=2026-09-12&dateTo=2026-09-10'),
      TODAY,
    );
    expect(result.dateRange).toEqual({ start: null, end: null });
  });

  test('rejects a malformed date string', () => {
    const result = resolveInitialReservationState(
      params('dateFrom=not-a-date&dateTo=2026-09-12'),
      TODAY,
    );
    expect(result.dateRange).toEqual({ start: null, end: null });
  });

  test('rejects a lone dateFrom with no dateTo', () => {
    const result = resolveInitialReservationState(
      params('dateFrom=2026-09-10'),
      TODAY,
    );
    expect(result.dateRange).toEqual({ start: null, end: null });
  });

  test('accepts a same-day dateFrom/dateTo', () => {
    const result = resolveInitialReservationState(
      params('dateFrom=2026-09-10&dateTo=2026-09-10'),
      TODAY,
    );
    expect(result.dateRange).toEqual({
      start: '2026-09-10',
      end: '2026-09-10',
    });
  });

  test.each([
    ['zero', '0'],
    ['negative', '-3'],
    ['non-numeric', 'abc'],
    ['a fraction', '2.5'],
    ['above the sane bound', '999'],
  ])('rejects a %s guests value, falling back to 1', (_label, value) => {
    const result = resolveInitialReservationState(
      params(`guests=${value}`),
      TODAY,
    );
    expect(result.guestCount).toBe(1);
  });

  test('accepts the upper guests bound exactly', () => {
    const result = resolveInitialReservationState(params('guests=50'), TODAY);
    expect(result.guestCount).toBe(50);
  });
});
