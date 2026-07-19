/**
 * Sprint 5 §9 / §17: "booking state transitions." Validates the pure
 * transition-rule function against the state diagram documented in
 * docs/SPRINT_5_DATABASE_FOUNDATION.md §5.1.
 */

import { describe, test, expect } from '@jest/globals';
import {
  BOOKING_STATUSES,
  isValidBookingStatusTransition,
  isTerminalBookingStatus,
} from '../../../../src/core/domain/bookingStatusTransitions.js';

describe('Booking status transitions (Sprint 5 §9 MVP machine)', () => {
  test('the full DRAFT -> PENDING_VENDOR -> CONFIRMED -> COMPLETED happy path is legal', () => {
    expect(isValidBookingStatusTransition('DRAFT', 'PENDING_VENDOR')).toBe(
      true,
    );
    expect(isValidBookingStatusTransition('PENDING_VENDOR', 'CONFIRMED')).toBe(
      true,
    );
    expect(isValidBookingStatusTransition('CONFIRMED', 'COMPLETED')).toBe(true);
  });

  test('a vendor may reject or let a pending request expire', () => {
    expect(isValidBookingStatusTransition('PENDING_VENDOR', 'REJECTED')).toBe(
      true,
    );
    expect(isValidBookingStatusTransition('PENDING_VENDOR', 'EXPIRED')).toBe(
      true,
    );
  });

  test('either party may cancel a confirmed booking, and a no-show is recordable', () => {
    expect(
      isValidBookingStatusTransition('CONFIRMED', 'CANCELLED_BY_CUSTOMER'),
    ).toBe(true);
    expect(
      isValidBookingStatusTransition('CONFIRMED', 'CANCELLED_BY_VENDOR'),
    ).toBe(true);
    expect(isValidBookingStatusTransition('CONFIRMED', 'NO_SHOW')).toBe(true);
  });

  test('a DRAFT cannot skip straight to CONFIRMED', () => {
    expect(isValidBookingStatusTransition('DRAFT', 'CONFIRMED')).toBe(false);
  });

  test('every terminal status has no outgoing transitions', () => {
    const terminalStatuses = [
      'REJECTED',
      'CANCELLED_BY_CUSTOMER',
      'CANCELLED_BY_VENDOR',
      'COMPLETED',
      'NO_SHOW',
      'EXPIRED',
    ];
    terminalStatuses.forEach((status) => {
      expect(isTerminalBookingStatus(status)).toBe(true);
      BOOKING_STATUSES.forEach((target) => {
        expect(isValidBookingStatusTransition(status, target)).toBe(false);
      });
    });
  });

  test('DRAFT and PENDING_VENDOR are not terminal', () => {
    expect(isTerminalBookingStatus('DRAFT')).toBe(false);
    expect(isTerminalBookingStatus('PENDING_VENDOR')).toBe(false);
  });

  test('an unknown status throws rather than silently allowing the transition', () => {
    expect(() =>
      isValidBookingStatusTransition('NOT_A_REAL_STATUS', 'CONFIRMED'),
    ).toThrow(TypeError);
    expect(() =>
      isValidBookingStatusTransition('DRAFT', 'NOT_A_REAL_STATUS'),
    ).toThrow(TypeError);
  });

  test('BOOKING_STATUSES exactly matches the 9 statuses seeded in migration 0008/seed 001', () => {
    // BOOKING_STATUSES is frozen — sort a copy, never the original.
    expect([...BOOKING_STATUSES].sort()).toEqual(
      [
        'DRAFT',
        'PENDING_VENDOR',
        'CONFIRMED',
        'REJECTED',
        'CANCELLED_BY_CUSTOMER',
        'CANCELLED_BY_VENDOR',
        'COMPLETED',
        'NO_SHOW',
        'EXPIRED',
      ].sort(),
    );
  });
});
