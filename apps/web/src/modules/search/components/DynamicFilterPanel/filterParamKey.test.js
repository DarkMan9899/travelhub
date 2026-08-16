import { describe, test, expect } from 'vitest';
import { getFilterParamKey } from './filterParamKey.js';

describe('getFilterParamKey (apps/web/src/modules/search/components/DynamicFilterPanel)', () => {
  test('AMENITY-sourced filters always resolve to the fixed amenityIds key', () => {
    expect(
      getFilterParamKey({
        code: 'amenity_ids',
        input_type: 'MULTI_SELECT',
        value_source: 'AMENITY',
      }),
    ).toEqual({ type: 'exact', key: 'amenityIds' });
  });

  test('STEPPER resolves to an attr_{code}_min key only', () => {
    expect(
      getFilterParamKey({
        code: 'bedrooms',
        input_type: 'STEPPER',
        value_source: 'ATTRIBUTE',
      }),
    ).toEqual({
      type: 'range',
      minKey: 'attr_bedrooms_min',
      maxKey: undefined,
    });
  });

  test('RANGE resolves to both attr_{code}_min and attr_{code}_max keys', () => {
    expect(
      getFilterParamKey({
        code: 'duration_minutes',
        input_type: 'RANGE',
        value_source: 'ATTRIBUTE',
      }),
    ).toEqual({
      type: 'range',
      minKey: 'attr_duration_minutes_min',
      maxKey: 'attr_duration_minutes_max',
    });
  });

  test('SINGLE_SELECT/MULTI_SELECT attribute filters resolve to the bare attr_{code} key', () => {
    expect(
      getFilterParamKey({
        code: 'star_rating',
        input_type: 'SINGLE_SELECT',
        value_source: 'ATTRIBUTE',
      }),
    ).toEqual({ type: 'exact', key: 'attr_star_rating' });

    expect(
      getFilterParamKey({
        code: 'cuisine',
        input_type: 'MULTI_SELECT',
        value_source: 'ATTRIBUTE',
      }),
    ).toEqual({ type: 'exact', key: 'attr_cuisine' });
  });
});
