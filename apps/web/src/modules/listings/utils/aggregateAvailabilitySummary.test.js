import { describe, test, expect } from 'vitest';
import { aggregateAvailabilitySummaryByUnitType } from './aggregateAvailabilitySummary.js';

describe('aggregateAvailabilitySummaryByUnitType', () => {
  test('merges same-type units into one badge entry, summing remaining_count for the winning status', () => {
    const summary = [
      {
        unit_id: 89,
        bookable_unit_type: 'VEHICLE',
        availability_status: 'LOW',
        remaining_count: 1,
      },
      {
        unit_id: 90,
        bookable_unit_type: 'VEHICLE',
        availability_status: 'LOW',
        remaining_count: 1,
      },
      {
        unit_id: 91,
        bookable_unit_type: 'VEHICLE',
        availability_status: 'LOW',
        remaining_count: 1,
      },
    ];
    const result = aggregateAvailabilitySummaryByUnitType(summary);
    expect(result).toEqual([
      {
        unit_id: 'VEHICLE',
        bookable_unit_type: 'VEHICLE',
        availability_status: 'LOW',
        remaining_count: 3,
      },
    ]);
  });

  test('prefers the most favorable status among same-type units (AVAILABLE beats LOW beats SOLD_OUT)', () => {
    const summary = [
      {
        unit_id: 1,
        bookable_unit_type: 'VEHICLE',
        availability_status: 'SOLD_OUT',
        remaining_count: 0,
      },
      {
        unit_id: 2,
        bookable_unit_type: 'VEHICLE',
        availability_status: 'AVAILABLE',
        remaining_count: null,
      },
      {
        unit_id: 3,
        bookable_unit_type: 'VEHICLE',
        availability_status: 'LOW',
        remaining_count: 2,
      },
    ];
    const result = aggregateAvailabilitySummaryByUnitType(summary);
    expect(result).toEqual([
      {
        unit_id: 'VEHICLE',
        bookable_unit_type: 'VEHICLE',
        availability_status: 'AVAILABLE',
        remaining_count: null,
      },
    ]);
  });

  test('keeps distinct unit types as separate badge entries', () => {
    const summary = [
      {
        unit_id: 1,
        bookable_unit_type: 'HOTEL_ROOM',
        availability_status: 'AVAILABLE',
        remaining_count: null,
      },
      {
        unit_id: 2,
        bookable_unit_type: 'HOTEL_ROOM',
        availability_status: 'AVAILABLE',
        remaining_count: null,
      },
      {
        unit_id: 3,
        bookable_unit_type: 'PROPERTY_UNIT',
        availability_status: 'LOW',
        remaining_count: 1,
      },
    ];
    const result = aggregateAvailabilitySummaryByUnitType(summary);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.bookable_unit_type).sort()).toEqual([
      'HOTEL_ROOM',
      'PROPERTY_UNIT',
    ]);
  });

  test('passes a single unit through unchanged (aside from wrapping)', () => {
    const summary = [
      {
        unit_id: 5,
        bookable_unit_type: 'HOTEL_ROOM',
        availability_status: 'LOW',
        remaining_count: 1,
      },
    ];
    const result = aggregateAvailabilitySummaryByUnitType(summary);
    expect(result).toEqual([
      {
        unit_id: 'HOTEL_ROOM',
        bookable_unit_type: 'HOTEL_ROOM',
        availability_status: 'LOW',
        remaining_count: 1,
      },
    ]);
  });

  test('returns an empty array for an empty summary', () => {
    expect(aggregateAvailabilitySummaryByUnitType([])).toEqual([]);
  });
});
