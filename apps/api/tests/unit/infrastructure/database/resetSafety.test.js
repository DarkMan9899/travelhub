/**
 * Unit tests for the pure safety checks `cli/resetDev.js` and
 * `cli/resetTest.js` are built on — this is the part that decides
 * whether a destructive DROP DATABASE against a developer's local
 * database is allowed to proceed, so it gets an automated test rather
 * than relying on a manual read-through of the CLI scripts themselves.
 */

import { describe, test, expect } from '@jest/globals';
import {
  isDevResetConfirmed,
  looksLikeTestDatabase,
} from '../../../../src/infrastructure/database/resetSafety.js';

describe('isDevResetConfirmed (db:reset:dev confirmation gate)', () => {
  test('refuses when no confirmation flag is present', () => {
    expect(isDevResetConfirmed([])).toBe(false);
    expect(isDevResetConfirmed(['--verbose'])).toBe(false);
  });

  test('allows when --confirm is present', () => {
    expect(isDevResetConfirmed(['--confirm'])).toBe(true);
  });

  test('allows when --yes is present', () => {
    expect(isDevResetConfirmed(['--yes'])).toBe(true);
  });

  test('allows when the flag is present alongside other arguments', () => {
    expect(isDevResetConfirmed(['--verbose', '--confirm'])).toBe(true);
  });
});

describe('looksLikeTestDatabase (db:reset:test defense-in-depth check)', () => {
  test('accepts names containing "test", case-insensitively', () => {
    expect(looksLikeTestDatabase('travelhub_test')).toBe(true);
    expect(looksLikeTestDatabase('TravelHub_Test')).toBe(true);
    expect(looksLikeTestDatabase('my_TEST_db')).toBe(true);
  });

  test('rejects names that do not look like a test database', () => {
    expect(looksLikeTestDatabase('travelhub_dev')).toBe(false);
    expect(looksLikeTestDatabase('travelhub')).toBe(false);
    expect(looksLikeTestDatabase('production')).toBe(false);
  });
});
