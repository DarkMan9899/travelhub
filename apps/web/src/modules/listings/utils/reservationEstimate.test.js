import { describe, test, expect } from 'vitest';
import { addDays, computeEstimatedTotal } from './reservationEstimate.js';

describe('addDays', () => {
  test('adds whole days across a month boundary', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02');
  });
});

describe('computeEstimatedTotal', () => {
  const priceByDate = {
    '2026-08-01': { price_amount: '100.00', price_currency: 'AMD' },
    '2026-08-02': { price_amount: '120.00', price_currency: 'AMD' },
    '2026-08-03': { price_amount: '150.00', price_currency: 'AMD' },
    '2026-08-04': { price_amount: null, price_currency: null },
  };

  test('returns null when no date range is selected', () => {
    expect(
      computeEstimatedTotal({ start: null, end: null }, priceByDate, 1),
    ).toBeNull();
  });

  test('sums each inclusive day in range for quantity 1', () => {
    const result = computeEstimatedTotal(
      { start: '2026-08-01', end: '2026-08-03' },
      priceByDate,
      1,
    );
    expect(result).toEqual({ amount: 370, currency: 'AMD' });
  });

  test('multiplies the summed range by quantity', () => {
    const result = computeEstimatedTotal(
      { start: '2026-08-01', end: '2026-08-02' },
      priceByDate,
      3,
    );
    expect(result).toEqual({ amount: 660, currency: 'AMD' });
  });

  test('returns null when any day in range has no resolvable price', () => {
    const result = computeEstimatedTotal(
      { start: '2026-08-03', end: '2026-08-04' },
      priceByDate,
      1,
    );
    expect(result).toBeNull();
  });

  test('returns null when a day in range is entirely missing from the map', () => {
    const result = computeEstimatedTotal(
      { start: '2026-08-01', end: '2026-08-10' },
      priceByDate,
      1,
    );
    expect(result).toBeNull();
  });
});
