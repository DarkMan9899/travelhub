/**
 * Launch-blocker remediation (P0-B): `BOOKING_REFUND_STATUSES` is the
 * single source of truth for `bookings.refund_status`'s vocabulary,
 * consumed by `bookingValidators.js`'s `refundStatus` query filter. This
 * pins the exact value set — including the two values this phase added —
 * so a typo in either list is caught immediately rather than surfacing
 * as a query that silently never matches.
 */

import { describe, test, expect } from '@jest/globals';
import { BOOKING_REFUND_STATUSES } from '../../../../src/core/domain/bookingRefundStatuses.js';

describe('BOOKING_REFUND_STATUSES (P0-B launch-blocker remediation)', () => {
  test('contains exactly the pre-existing values plus the two new manual-review outcomes', () => {
    expect([...BOOKING_REFUND_STATUSES].sort()).toEqual(
      [
        'NOT_APPLICABLE',
        'AUTO_REFUNDED',
        'REQUIRES_MANUAL_REVIEW',
        'REFUND_FAILED',
        'MANUALLY_REFUNDED',
        'RESOLVED_NO_REFUND',
      ].sort(),
    );
  });

  test('is frozen (no accidental runtime mutation)', () => {
    expect(Object.isFrozen(BOOKING_REFUND_STATUSES)).toBe(true);
  });
});
