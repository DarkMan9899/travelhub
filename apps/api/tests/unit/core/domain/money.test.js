/**
 * Sprint 5 §3: "Do not use floating-point values for money." These tests
 * exercise Money's integer-minor-units representation and its
 * MySQL-DECIMAL-string round-trip, since a regression here would
 * reintroduce float rounding error into every price in the system.
 */

import { describe, test, expect } from '@jest/globals';
import { Money } from '../../../../src/core/domain/money.js';

describe('Money value object (src/core/domain/money.js)', () => {
  test('fromDecimalString parses a MySQL DECIMAL string exactly, never via parseFloat', () => {
    const price = Money.fromDecimalString('19.99', 'USD');
    expect(price.minorUnits).toBe(1999);
    expect(price.currency).toBe('USD');
  });

  test('fromDecimalString handles a whole-number decimal string with no fraction', () => {
    const price = Money.fromDecimalString('50', 'AMD');
    expect(price.minorUnits).toBe(5000);
  });

  test('fromDecimalString handles a negative amount', () => {
    const price = Money.fromDecimalString('-4.50', 'EUR');
    expect(price.minorUnits).toBe(-450);
    expect(price.isNegative()).toBe(true);
  });

  test('fromDecimalString rejects a malformed string', () => {
    expect(() => Money.fromDecimalString('not-a-number', 'USD')).toThrow(
      TypeError,
    );
  });

  test('toDecimalString round-trips exactly, avoiding the classic 0.1 + 0.2 float bug', () => {
    const a = Money.fromDecimalString('0.10', 'USD');
    const b = Money.fromDecimalString('0.20', 'USD');
    expect(a.add(b).toDecimalString()).toBe('0.30');
  });

  test('add/subtract only operate on matching currency', () => {
    const usd = Money.fromDecimalString('10.00', 'USD');
    const eur = Money.fromDecimalString('10.00', 'EUR');
    expect(() => usd.add(eur)).toThrow(TypeError);
  });

  test('multiply rounds to the nearest minor unit', () => {
    const price = Money.fromDecimalString('10.00', 'USD');
    // 10.00 * 0.075 = 0.75 exactly in minor units (1000 * 0.075 = 75)
    expect(price.multiply(0.075).toDecimalString()).toBe('0.75');
  });

  test('zero() and isZero() agree', () => {
    expect(Money.zero('AMD').isZero()).toBe(true);
  });

  test('equals compares both currency and amount', () => {
    const a = Money.fromDecimalString('5.00', 'USD');
    const b = Money.fromDecimalString('5.00', 'USD');
    const c = Money.fromDecimalString('5.00', 'EUR');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  test('constructor rejects a non-integer minor-units value', () => {
    expect(() => new Money(19.99, 'USD')).toThrow(TypeError);
  });
});
