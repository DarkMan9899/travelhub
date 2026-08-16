import { describe, test, expect } from 'vitest';
import {
  toPolicyValuesPayload,
  fromPolicyValuesResponse,
} from './policyValueMapping.js';

const DEFINITIONS = [
  { code: 'pets_allowed', data_type: 'BOOLEAN' },
  { code: 'cancellation_policy', data_type: 'ENUM' },
  { code: 'check_in_time', data_type: 'STRING' },
];

describe('policyValueMapping', () => {
  describe('toPolicyValuesPayload', () => {
    test('serializes BOOLEAN as the literal string "true"/"false"', () => {
      const payload = toPolicyValuesPayload(DEFINITIONS, {
        pets_allowed: true,
      });
      expect(payload).toEqual([{ code: 'pets_allowed', value: 'true' }]);

      const payloadFalse = toPolicyValuesPayload(DEFINITIONS, {
        pets_allowed: false,
      });
      expect(payloadFalse).toEqual([{ code: 'pets_allowed', value: 'false' }]);
    });

    test('serializes every other data type as a plain string', () => {
      const payload = toPolicyValuesPayload(DEFINITIONS, {
        cancellation_policy: 'MODERATE',
        check_in_time: '14:00',
      });
      expect(payload).toEqual(
        expect.arrayContaining([
          { code: 'cancellation_policy', value: 'MODERATE' },
          { code: 'check_in_time', value: '14:00' },
        ]),
      );
    });

    test('omits definitions with no provided value', () => {
      const payload = toPolicyValuesPayload(DEFINITIONS, {
        pets_allowed: undefined,
        check_in_time: '',
        cancellation_policy: 'MODERATE',
      });
      expect(payload).toEqual([
        { code: 'cancellation_policy', value: 'MODERATE' },
      ]);
    });
  });

  describe('fromPolicyValuesResponse', () => {
    test('parses BOOLEAN from the wire\'s "true"/"false" string', () => {
      const result = fromPolicyValuesResponse(DEFINITIONS, [
        { code: 'pets_allowed', value: 'true' },
      ]);
      expect(result.pets_allowed).toBe(true);

      const resultFalse = fromPolicyValuesResponse(DEFINITIONS, [
        { code: 'pets_allowed', value: 'false' },
      ]);
      expect(resultFalse.pets_allowed).toBe(false);
    });

    test('passes ENUM/STRING values through unchanged', () => {
      const result = fromPolicyValuesResponse(DEFINITIONS, [
        { code: 'cancellation_policy', value: 'MODERATE' },
        { code: 'check_in_time', value: '14:00' },
      ]);
      expect(result.cancellation_policy).toBe('MODERATE');
      expect(result.check_in_time).toBe('14:00');
    });

    test('skips a definition with no matching entry', () => {
      const result = fromPolicyValuesResponse(DEFINITIONS, []);
      expect(result).toEqual({});
    });

    test('treats a missing policyValues array as empty', () => {
      const result = fromPolicyValuesResponse(DEFINITIONS, undefined);
      expect(result).toEqual({});
    });
  });
});
