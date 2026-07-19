/**
 * Sprint 5 §17: "configuration validation." Config is validated once at
 * module load (BACKEND_ARCHITECTURE.md §18) via envalid's `cleanEnv` —
 * these tests assert the resulting shape, its immutability, and Sprint
 * 5's test-database-isolation switch (§3 "test database isolation"): in
 * a Jest run (NODE_ENV=test), config.database.name must resolve to
 * DATABASE_NAME_TEST, never the development database.
 */

import { describe, test, expect } from '@jest/globals';
import config from '../../../src/config/index.js';

describe('Configuration loader (src/config/index.js)', () => {
  test('NODE_ENV=test resolves database.name to the isolated test database, never DATABASE_NAME', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(config.isTest).toBe(true);
    expect(config.database.name).toBe('travelhub_test');
  });

  test('the config object and every nested section are frozen (no accidental runtime mutation)', () => {
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.database)).toBe(true);
    expect(Object.isFrozen(config.redis)).toBe(true);
    expect(Object.isFrozen(config.jwt)).toBe(true);
    expect(Object.isFrozen(config.rateLimit)).toBe(true);
    expect(Object.isFrozen(config.cors)).toBe(true);
  });

  test('rate-limit tiers are present and numeric, ordered sensitive < public < authenticated', () => {
    const { sensitivePerMinute, publicPerMinute, authenticatedPerMinute } =
      config.rateLimit;
    expect(typeof sensitivePerMinute).toBe('number');
    expect(typeof publicPerMinute).toBe('number');
    expect(typeof authenticatedPerMinute).toBe('number');
    expect(sensitivePerMinute).toBeLessThan(publicPerMinute);
    expect(publicPerMinute).toBeLessThan(authenticatedPerMinute);
  });

  test('cors.allowedOrigins is a parsed, trimmed array, not the raw comma-separated string', () => {
    expect(Array.isArray(config.cors.allowedOrigins)).toBe(true);
    config.cors.allowedOrigins.forEach((origin) => {
      expect(origin).toBe(origin.trim());
    });
  });

  test('booking.holdDurationMinutes is a positive number', () => {
    expect(config.booking.holdDurationMinutes).toBeGreaterThan(0);
  });
});
