/**
 * Phase 8 (Auth / User Dashboard): unit coverage for
 * `toBookingSummaryResponse`'s additive `date_from`/`date_to` fields
 * (earliest/latest booking-item dates, resolved via a repository-level
 * LEFT JOIN). Pure mapping function, no database needed, mirroring
 * `tests/unit/modules/availability/availabilityDto.test.js`'s convention.
 */

import { describe, test, expect } from '@jest/globals';
import {
  toBookingResponse,
  toBookingSummaryResponse,
} from '../../../../src/modules/bookings/dto/bookingDto.js';

describe('toBookingResponse', () => {
  test('includes partner_owner_user_id when bookingService resolved one', () => {
    const response = toBookingResponse({
      id: 1,
      bookingReference: 'BK-20260101-ABCDEF23',
      customerUserId: 2,
      partnerId: 5,
      partnerOwnerUserId: 7,
      listingId: 5,
      bookingTypeCode: 'PROPERTY_UNIT',
      statusCode: 'CONFIRMED',
      currencyCode: 'AMD',
      totalAmount: '85000.00',
    });

    expect(response.partner_owner_user_id).toBe(7);
  });

  test('partner_owner_user_id is null when the partner has no resolvable owner', () => {
    const response = toBookingResponse({
      id: 1,
      bookingReference: 'BK-20260101-ABCDEF23',
      customerUserId: 2,
      partnerId: 5,
      listingId: 5,
      bookingTypeCode: 'PROPERTY_UNIT',
      statusCode: 'CONFIRMED',
      currencyCode: 'AMD',
      totalAmount: '85000.00',
    });

    expect(response.partner_owner_user_id).toBeNull();
  });
});

describe('toBookingSummaryResponse', () => {
  test('includes date_from/date_to from tripDateFrom/tripDateTo', () => {
    const response = toBookingSummaryResponse({
      id: 1,
      bookingReference: 'BK-20260101-ABCDEF23',
      listingId: 5,
      bookingTypeCode: 'PROPERTY_UNIT',
      statusCode: 'CONFIRMED',
      currencyCode: 'AMD',
      totalAmount: '85000.00',
      requestedAt: new Date('2026-01-01'),
      tripDateFrom: '2026-08-01',
      tripDateTo: '2026-08-03',
    });

    expect(response.date_from).toBe('2026-08-01');
    expect(response.date_to).toBe('2026-08-03');
  });

  test('date_from/date_to are null when no trip dates were resolved', () => {
    const response = toBookingSummaryResponse({
      id: 2,
      bookingReference: 'BK-20260101-ZZZZZZZZ',
      listingId: 5,
      bookingTypeCode: 'PROPERTY_UNIT',
      statusCode: 'DRAFT',
      currencyCode: 'AMD',
      totalAmount: '0.00',
      requestedAt: new Date('2026-01-01'),
    });

    expect(response.date_from).toBeNull();
    expect(response.date_to).toBeNull();
  });
});
