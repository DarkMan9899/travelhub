import { describe, test, expect } from 'vitest';
import { computeNights } from './computeNights.js';

describe('computeNights (apps/web/src/modules/bookings)', () => {
  test('computes checkout-exclusive nights for a HOTEL_ROOM item', () => {
    expect(
      computeNights({
        bookable_unit_type: 'HOTEL_ROOM',
        date_from: '2026-08-01',
        date_to: '2026-08-04',
      }),
    ).toBe(3);
  });

  test('computes checkout-exclusive nights for a PROPERTY_UNIT item', () => {
    expect(
      computeNights({
        bookable_unit_type: 'PROPERTY_UNIT',
        date_from: '2026-08-10',
        date_to: '2026-08-11',
      }),
    ).toBe(1);
  });

  test('returns null for a non-accommodation unit type', () => {
    expect(
      computeNights({
        bookable_unit_type: 'TOUR_DEPARTURE',
        date_from: '2026-08-01',
        date_to: '2026-08-04',
      }),
    ).toBeNull();
  });

  test('returns null when the unit type is missing (legacy item)', () => {
    expect(
      computeNights({ date_from: '2026-08-01', date_to: '2026-08-04' }),
    ).toBeNull();
  });

  test('returns null when dates are missing', () => {
    expect(computeNights({ bookable_unit_type: 'HOTEL_ROOM' })).toBeNull();
  });
});
