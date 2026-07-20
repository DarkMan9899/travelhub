/**
 * Sprint 10: `booking_type_id` is always derived server-side from the
 * bookable unit being booked (never client-supplied) — this is the pure
 * mapping that derivation goes through, mirroring both seeded lookup
 * tables (`seeds/001_lookups.js`) exactly.
 */

import { describe, test, expect } from '@jest/globals';
import { BOOKABLE_UNIT_TYPES } from '../../../../src/core/domain/bookableUnitTypes.js';
import {
  BOOKABLE_UNIT_TYPE_TO_BOOKING_TYPE,
  resolveBookingTypeCode,
} from '../../../../src/core/domain/bookableUnitTypeToBookingType.js';

describe('resolveBookingTypeCode', () => {
  test('every bookable unit type maps to a booking type', () => {
    BOOKABLE_UNIT_TYPES.forEach((code) => {
      expect(() => resolveBookingTypeCode(code)).not.toThrow();
      expect(typeof resolveBookingTypeCode(code)).toBe('string');
    });
  });

  test('maps each seeded code to its documented booking type', () => {
    expect(resolveBookingTypeCode('HOTEL_ROOM')).toBe('HOTEL_ROOM_BOOKING');
    expect(resolveBookingTypeCode('PROPERTY_UNIT')).toBe('PROPERTY_BOOKING');
    expect(resolveBookingTypeCode('RESTAURANT_TABLE')).toBe(
      'RESTAURANT_RESERVATION',
    );
    expect(resolveBookingTypeCode('TOUR_DEPARTURE')).toBe('TOUR_BOOKING');
    expect(resolveBookingTypeCode('VEHICLE')).toBe('CAR_RENTAL_BOOKING');
  });

  test('throws for an unknown bookable unit type rather than returning undefined', () => {
    expect(() => resolveBookingTypeCode('SPACESHIP_BERTH')).toThrow(TypeError);
  });

  test('the exported map has no extra or missing keys versus BOOKABLE_UNIT_TYPES', () => {
    expect(Object.keys(BOOKABLE_UNIT_TYPE_TO_BOOKING_TYPE).sort()).toEqual(
      [...BOOKABLE_UNIT_TYPES].sort(),
    );
  });
});
