/**
 * JWT go-live preflight (test-readiness remediation, 2026) —
 * `config/index.js`'s `assertProductionSecretsAreConfigured` guard.
 * Mirrors `paymentProviderRegistry.test.js`'s "production fail-closed
 * guard" shape, but exercises the REAL `config/index.js` module rather
 * than a mock of it — this file's whole subject IS that module, so
 * mocking it would test nothing. Each test sets real `process.env`
 * values, `jest.resetModules()`s so the next dynamic `import()` of
 * `config/index.js` re-runs `cleanEnv`/the guard from scratch (the
 * module-level guard call only ever fires once, at first import, so a
 * cached module from an earlier test would silently skip it), then
 * restores every env var it touched in `afterEach` so this file's own
 * env mutations never leak into another test file sharing the same Jest
 * worker.
 *
 * The guard also covers `CONNECTOR_CONFIG_ENCRYPTION_KEY` (see
 * `connectorConfigEncryptionKeyProductionGuard.test.js` for that secret's
 * own focused coverage) — every test below that expects a successful
 * production boot sets that var to a real value too, so it never
 * incidentally trips on a DIFFERENT secret than the one under test here.
 */

import { describe, test, expect, jest, afterEach } from '@jest/globals';

const CONFIG_MODULE_PATH = '../../../src/config/index.js';
const REAL_SECRET_A = 'a-real-unique-production-secret-value-123';
const REAL_SECRET_B = 'another-real-unique-production-secret-456';
const REAL_CONNECTOR_KEY = 'a-real-unique-connector-encryption-key-789';

const ENV_KEYS = [
  'NODE_ENV',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'CONNECTOR_CONFIG_ENCRYPTION_KEY',
];
const originalEnv = {};

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (key in originalEnv) {
      process.env[key] = originalEnv[key];
      delete originalEnv[key];
    } else {
      delete process.env[key];
    }
  });
  jest.resetModules();
});

function setEnv(key, value) {
  if (!(key in originalEnv)) originalEnv[key] = process.env[key];
  process.env[key] = value;
}

describe('config/index.js — JWT production preflight guard', () => {
  test('NODE_ENV=production with both JWT secrets left at their known development placeholder refuses to load, naming both', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('JWT_ACCESS_SECRET', 'dev-only-access-secret-change-me');
    setEnv('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me');
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', REAL_CONNECTOR_KEY);
    jest.resetModules();

    let caught;
    try {
      await import(CONFIG_MODULE_PATH);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toMatch(/JWT_ACCESS_SECRET/);
    expect(caught.message).toMatch(/JWT_REFRESH_SECRET/);
  });

  test('NODE_ENV=production with the access secret missing entirely (empty string) also refuses to load', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('JWT_ACCESS_SECRET', '');
    setEnv('JWT_REFRESH_SECRET', REAL_SECRET_B);
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', REAL_CONNECTOR_KEY);
    jest.resetModules();

    await expect(import(CONFIG_MODULE_PATH)).rejects.toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  test('NODE_ENV=production with only the refresh secret still at its placeholder refuses to load, naming only that one', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('JWT_ACCESS_SECRET', REAL_SECRET_A);
    setEnv('JWT_REFRESH_SECRET', 'dev-only-refresh-secret-change-me');
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', REAL_CONNECTOR_KEY);
    jest.resetModules();

    let caught;
    try {
      await import(CONFIG_MODULE_PATH);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toMatch(/JWT_REFRESH_SECRET/);
    expect(caught.message).not.toMatch(/JWT_ACCESS_SECRET/);
  });

  test('NODE_ENV=production with both JWT secrets and a real connector key set boots successfully', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('JWT_ACCESS_SECRET', REAL_SECRET_A);
    setEnv('JWT_REFRESH_SECRET', REAL_SECRET_B);
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', REAL_CONNECTOR_KEY);
    jest.resetModules();

    const { default: config } = await import(CONFIG_MODULE_PATH);
    expect(config.isProduction).toBe(true);
    expect(config.jwt.accessSecret).toBe(REAL_SECRET_A);
    expect(config.jwt.refreshSecret).toBe(REAL_SECRET_B);
  });

  test("NODE_ENV=test (this suite's own real environment) boots successfully with no secrets set at all — development/test convenience is unaffected", async () => {
    setEnv('NODE_ENV', 'test');
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.CONNECTOR_CONFIG_ENCRYPTION_KEY;
    jest.resetModules();

    const { default: config } = await import(CONFIG_MODULE_PATH);
    expect(config.isProduction).toBe(false);
    expect(config.jwt.accessSecret).toBe('dev-only-access-secret-change-me');
  });
});
