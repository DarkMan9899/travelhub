/**
 * Phase 16: validates the pure Payment state-transition function against
 * `paymentStatusTransitions.js`'s documented machine.
 */

import { describe, test, expect } from '@jest/globals';
import {
  PAYMENT_STATUSES,
  isValidPaymentStatusTransition,
  isTerminalPaymentStatus,
  isActivePaymentStatus,
} from '../../../../src/core/domain/paymentStatusTransitions.js';

describe('Payment status transitions (Phase 16)', () => {
  test('CREATED can resolve directly to SUCCEEDED (synchronous providers) or via PROCESSING (async providers)', () => {
    expect(isValidPaymentStatusTransition('CREATED', 'SUCCEEDED')).toBe(true);
    expect(isValidPaymentStatusTransition('CREATED', 'PROCESSING')).toBe(true);
    expect(isValidPaymentStatusTransition('PROCESSING', 'SUCCEEDED')).toBe(
      true,
    );
  });

  test('a declined/cancelled payment intent is a legal transition from CREATED', () => {
    expect(isValidPaymentStatusTransition('CREATED', 'FAILED')).toBe(true);
    expect(isValidPaymentStatusTransition('CREATED', 'CANCELLED')).toBe(true);
  });

  test('a succeeded payment may be partially or fully refunded, and repeated partial refunds are legal', () => {
    expect(
      isValidPaymentStatusTransition('SUCCEEDED', 'PARTIALLY_REFUNDED'),
    ).toBe(true);
    expect(isValidPaymentStatusTransition('SUCCEEDED', 'REFUNDED')).toBe(true);
    expect(
      isValidPaymentStatusTransition(
        'PARTIALLY_REFUNDED',
        'PARTIALLY_REFUNDED',
      ),
    ).toBe(true);
    expect(
      isValidPaymentStatusTransition('PARTIALLY_REFUNDED', 'REFUNDED'),
    ).toBe(true);
  });

  test('a succeeded payment cannot revert to CREATED or FAILED', () => {
    expect(isValidPaymentStatusTransition('SUCCEEDED', 'CREATED')).toBe(false);
    expect(isValidPaymentStatusTransition('SUCCEEDED', 'FAILED')).toBe(false);
  });

  test('every terminal status has no outgoing transitions', () => {
    ['FAILED', 'CANCELLED', 'REFUNDED'].forEach((status) => {
      expect(isTerminalPaymentStatus(status)).toBe(true);
      PAYMENT_STATUSES.forEach((target) => {
        expect(isValidPaymentStatusTransition(status, target)).toBe(false);
      });
    });
  });

  test('isActivePaymentStatus is false only for FAILED/CANCELLED/REFUNDED', () => {
    expect(isActivePaymentStatus('CREATED')).toBe(true);
    expect(isActivePaymentStatus('PROCESSING')).toBe(true);
    expect(isActivePaymentStatus('SUCCEEDED')).toBe(true);
    expect(isActivePaymentStatus('PARTIALLY_REFUNDED')).toBe(true);
    expect(isActivePaymentStatus('FAILED')).toBe(false);
    expect(isActivePaymentStatus('CANCELLED')).toBe(false);
    expect(isActivePaymentStatus('REFUNDED')).toBe(false);
  });

  test('an unknown status throws rather than silently allowing the transition', () => {
    expect(() =>
      isValidPaymentStatusTransition('NOT_REAL', 'SUCCEEDED'),
    ).toThrow(TypeError);
    expect(() => isValidPaymentStatusTransition('CREATED', 'NOT_REAL')).toThrow(
      TypeError,
    );
    expect(() => isActivePaymentStatus('NOT_REAL')).toThrow(TypeError);
  });

  test('PAYMENT_STATUSES exactly matches the 9 statuses seeded in migration 0024/seed 011', () => {
    expect([...PAYMENT_STATUSES].sort()).toEqual(
      [
        'CREATED',
        'REQUIRES_ACTION',
        'PROCESSING',
        'AUTHORIZED',
        'SUCCEEDED',
        'FAILED',
        'CANCELLED',
        'PARTIALLY_REFUNDED',
        'REFUNDED',
      ].sort(),
    );
  });
});
