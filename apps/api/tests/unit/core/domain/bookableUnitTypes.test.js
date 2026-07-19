/**
 * Sprint 9: `BOOKABLE_UNIT_TYPES` must exactly match the seeded
 * `bookable_unit_types` vocabulary (seeds/001_lookups.js), since
 * `availabilityValidators.js`'s Zod enum is built directly from it.
 */

import { describe, test, expect } from '@jest/globals';
import { BOOKABLE_UNIT_TYPES } from '../../../../src/core/domain/bookableUnitTypes.js';

describe('BOOKABLE_UNIT_TYPES', () => {
  test('exactly matches the 5 types seeded in migration 0007/seed 001', () => {
    expect([...BOOKABLE_UNIT_TYPES].sort()).toEqual(
      [
        'HOTEL_ROOM',
        'PROPERTY_UNIT',
        'RESTAURANT_TABLE',
        'TOUR_DEPARTURE',
        'VEHICLE',
      ].sort(),
    );
  });

  test('is frozen (immutable)', () => {
    expect(Object.isFrozen(BOOKABLE_UNIT_TYPES)).toBe(true);
  });
});
