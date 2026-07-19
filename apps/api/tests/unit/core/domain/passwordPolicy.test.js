/**
 * Sprint 6 / API_SPECIFICATION.md §27: "password meets minimum strength
 * policy (length + character variety)."
 */

import { describe, test, expect } from '@jest/globals';
import { isStrongPassword } from '../../../../src/core/domain/passwordPolicy.js';

describe('isStrongPassword (src/core/domain/passwordPolicy.js)', () => {
  test('accepts a password with length + 3 character classes', () => {
    expect(isStrongPassword('DevAdmin!2024')).toBe(true);
  });

  test('rejects a password shorter than the minimum length', () => {
    expect(isStrongPassword('Ab1!')).toBe(false);
  });

  test('rejects a long password with only one character class', () => {
    expect(isStrongPassword('lowercaseonlylongpassword')).toBe(false);
  });

  test('rejects a long password with only two character classes', () => {
    expect(isStrongPassword('lowercaseanduppercaseonly')).toBe(false);
  });

  test('accepts a long password with exactly three character classes', () => {
    expect(isStrongPassword('lowercaseANDUPPER123')).toBe(true);
  });

  test('rejects a non-string value rather than throwing', () => {
    expect(isStrongPassword(undefined)).toBe(false);
    expect(isStrongPassword(12345678901)).toBe(false);
  });
});
