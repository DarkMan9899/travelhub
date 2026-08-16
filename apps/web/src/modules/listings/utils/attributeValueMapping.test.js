import { describe, test, expect } from 'vitest';
import {
  toAttributeValuesPayload,
  fromAttributeValuesResponse,
} from './attributeValueMapping.js';

const DEFINITIONS = [
  { code: 'max_group_size', data_type: 'INTEGER' },
  { code: 'has_ac', data_type: 'BOOLEAN' },
  { code: 'view_type', data_type: 'ENUM' },
  { code: 'languages_offered', data_type: 'MULTI_ENUM' },
  { code: 'notes', data_type: 'STRING' },
];

describe('attributeValueMapping', () => {
  describe('toAttributeValuesPayload', () => {
    test('sends MULTI_ENUM as optionCodes (array), unchanged', () => {
      const payload = toAttributeValuesPayload(DEFINITIONS, {
        languages_offered: ['en', 'hy'],
      });
      expect(payload).toEqual([
        { code: 'languages_offered', optionCodes: ['en', 'hy'] },
      ]);
    });

    test('sends ENUM as a single-element optionCodes array', () => {
      const payload = toAttributeValuesPayload(DEFINITIONS, {
        view_type: 'sea',
      });
      expect(payload).toEqual([{ code: 'view_type', optionCodes: ['sea'] }]);
    });

    test('sends every other data type as a plain value', () => {
      const payload = toAttributeValuesPayload(DEFINITIONS, {
        max_group_size: 6,
        has_ac: true,
      });
      expect(payload).toEqual(
        expect.arrayContaining([
          { code: 'max_group_size', value: 6 },
          { code: 'has_ac', value: true },
        ]),
      );
    });

    test('omits definitions with no provided value (undefined/null/empty string)', () => {
      const payload = toAttributeValuesPayload(DEFINITIONS, {
        max_group_size: undefined,
        has_ac: null,
        notes: '',
        view_type: 'sea',
      });
      expect(payload).toEqual([{ code: 'view_type', optionCodes: ['sea'] }]);
    });
  });

  describe('fromAttributeValuesResponse', () => {
    test('unwraps MULTI_ENUM from option_codes, defaulting to an empty array', () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, [
        { code: 'languages_offered', option_codes: ['en', 'ru'] },
      ]);
      expect(result.languages_offered).toEqual(['en', 'ru']);
    });

    test('unwraps ENUM from the first element of option_codes', () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, [
        { code: 'view_type', option_codes: ['sea'] },
      ]);
      expect(result.view_type).toBe('sea');
    });

    test('coerces INTEGER/DECIMAL values to a Number', () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, [
        { code: 'max_group_size', value: '6' },
      ]);
      expect(result.max_group_size).toBe(6);
    });

    test("coerces BOOLEAN values from the wire's 0/1 representation", () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, [
        { code: 'has_ac', value: '1' },
      ]);
      expect(result.has_ac).toBe(true);
    });

    test('passes STRING values through unchanged', () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, [
        { code: 'notes', value: 'Ground floor unit' },
      ]);
      expect(result.notes).toBe('Ground floor unit');
    });

    test('skips a definition with no matching entry in attributeValues', () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, []);
      expect(result).toEqual({});
    });

    test('treats a missing attributeValues array as empty', () => {
      const result = fromAttributeValuesResponse(DEFINITIONS, undefined);
      expect(result).toEqual({});
    });
  });
});
