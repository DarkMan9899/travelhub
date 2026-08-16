/**
 * Phase 16: validates the pure Refund state-transition function against
 * `refundStatusTransitions.js`'s documented machine.
 */

import { describe, test, expect } from '@jest/globals';
import {
  REFUND_STATUSES,
  isValidRefundStatusTransition,
  isTerminalRefundStatus,
} from '../../../../src/core/domain/refundStatusTransitions.js';

describe('Refund status transitions (Phase 16)', () => {
  test('the CREATED -> PROCESSING -> SUCCEEDED happy path is legal', () => {
    expect(isValidRefundStatusTransition('CREATED', 'PROCESSING')).toBe(true);
    expect(isValidRefundStatusTransition('PROCESSING', 'SUCCEEDED')).toBe(true);
  });

  test('CREATED can also resolve directly to SUCCEEDED or FAILED (a synchronous provider, e.g. LocalPaymentProvider, refunds in one step)', () => {
    expect(isValidRefundStatusTransition('CREATED', 'SUCCEEDED')).toBe(true);
    expect(isValidRefundStatusTransition('CREATED', 'FAILED')).toBe(true);
  });

  test('a refund may fail while processing, or be cancelled before processing starts', () => {
    expect(isValidRefundStatusTransition('PROCESSING', 'FAILED')).toBe(true);
    expect(isValidRefundStatusTransition('CREATED', 'CANCELLED')).toBe(true);
  });

  test('every terminal status has no outgoing transitions', () => {
    ['SUCCEEDED', 'FAILED', 'CANCELLED'].forEach((status) => {
      expect(isTerminalRefundStatus(status)).toBe(true);
      REFUND_STATUSES.forEach((target) => {
        expect(isValidRefundStatusTransition(status, target)).toBe(false);
      });
    });
  });

  test('an unknown status throws rather than silently allowing the transition', () => {
    expect(() =>
      isValidRefundStatusTransition('NOT_REAL', 'SUCCEEDED'),
    ).toThrow(TypeError);
    expect(() => isValidRefundStatusTransition('CREATED', 'NOT_REAL')).toThrow(
      TypeError,
    );
  });

  test('REFUND_STATUSES exactly matches the 5 statuses seeded in migration 0024/seed 011', () => {
    expect([...REFUND_STATUSES].sort()).toEqual(
      ['CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'].sort(),
    );
  });
});
