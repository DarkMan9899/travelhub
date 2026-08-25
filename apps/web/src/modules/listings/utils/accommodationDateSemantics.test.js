import { describe, test, expect } from 'vitest';
import {
  isAccommodationUnitType,
  resolveConsumedRange,
} from './accommodationDateSemantics.js';

describe('isAccommodationUnitType', () => {
  test('HOTEL_ROOM and PROPERTY_UNIT are accommodation types', () => {
    expect(isAccommodationUnitType('HOTEL_ROOM')).toBe(true);
    expect(isAccommodationUnitType('PROPERTY_UNIT')).toBe(true);
  });

  test('every other bookable unit type is not', () => {
    expect(isAccommodationUnitType('TOUR_DEPARTURE')).toBe(false);
    expect(isAccommodationUnitType('VEHICLE')).toBe(false);
    expect(isAccommodationUnitType('RESTAURANT_TABLE')).toBe(false);
    expect(isAccommodationUnitType(undefined)).toBe(false);
  });
});

describe('resolveConsumedRange', () => {
  test('an accommodation range drops the checkout day', () => {
    expect(
      resolveConsumedRange('HOTEL_ROOM', '2026-08-10', '2026-08-13'),
    ).toEqual({
      dateFrom: '2026-08-10',
      dateTo: '2026-08-12',
    });
  });

  test('a same-day accommodation selection is left untouched (a real 1-day charge)', () => {
    expect(
      resolveConsumedRange('HOTEL_ROOM', '2026-08-10', '2026-08-10'),
    ).toEqual({
      dateFrom: '2026-08-10',
      dateTo: '2026-08-10',
    });
  });

  test('a non-accommodation type keeps the full inclusive range', () => {
    expect(resolveConsumedRange('VEHICLE', '2026-08-10', '2026-08-13')).toEqual(
      {
        dateFrom: '2026-08-10',
        dateTo: '2026-08-13',
      },
    );
  });
});
