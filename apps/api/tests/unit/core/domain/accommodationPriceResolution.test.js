import { describe, test, expect } from '@jest/globals';
import { resolvePriceForDate } from '../../../../src/core/domain/accommodationPriceResolution.js';

describe('resolvePriceForDate', () => {
  test('rung 1 (override) wins when present', () => {
    expect(
      resolvePriceForDate({
        overrideAmount: 150,
        overrideCurrencyCode: 'AMD',
        unitBaseAmount: 80,
        unitBaseCurrencyCode: 'AMD',
        listingBaseAmount: 40,
        listingBaseCurrencyCode: 'AMD',
      }),
    ).toEqual({ amount: 150, currencyCode: 'AMD' });
  });

  test('rung 2 (unit base) wins when no override is present', () => {
    expect(
      resolvePriceForDate({
        overrideAmount: undefined,
        overrideCurrencyCode: undefined,
        unitBaseAmount: 80,
        unitBaseCurrencyCode: 'AMD',
        listingBaseAmount: 40,
        listingBaseCurrencyCode: 'AMD',
      }),
    ).toEqual({ amount: 80, currencyCode: 'AMD' });
  });

  test('rung 3 (listing fallback) wins when neither override nor unit base is present', () => {
    expect(
      resolvePriceForDate({
        unitBaseAmount: null,
        unitBaseCurrencyCode: null,
        listingBaseAmount: 40,
        listingBaseCurrencyCode: 'AMD',
      }),
    ).toEqual({ amount: 40, currencyCode: 'AMD' });
  });

  test('returns null when no rung has a price', () => {
    expect(resolvePriceForDate({})).toBeNull();
  });

  test('an override with an amount but no currency does not count as resolved — falls through to the next rung', () => {
    expect(
      resolvePriceForDate({
        overrideAmount: 150,
        overrideCurrencyCode: null,
        unitBaseAmount: 80,
        unitBaseCurrencyCode: 'AMD',
      }),
    ).toEqual({ amount: 80, currencyCode: 'AMD' });
  });

  test('a unit base amount of 0 is not the same as "unset" — it still resolves (0 is a valid explicit price)', () => {
    expect(
      resolvePriceForDate({
        unitBaseAmount: 0,
        unitBaseCurrencyCode: 'AMD',
        listingBaseAmount: 40,
        listingBaseCurrencyCode: 'AMD',
      }),
    ).toEqual({ amount: 0, currencyCode: 'AMD' });
  });
});
