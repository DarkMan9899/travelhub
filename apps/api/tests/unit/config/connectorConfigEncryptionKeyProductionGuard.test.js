/**
 * Connector-config-encryption-key go-live preflight (P1 launch blocker,
 * marketplace audit) — `config/index.js`'s
 * `assertProductionSecretsAreConfigured` guard, this time for
 * `CONNECTOR_CONFIG_ENCRYPTION_KEY` rather than the JWT secrets
 * `jwtProductionGuard.test.js` already covers (see that file for the
 * shared mechanics this one reuses: real env-var mutation + dynamic
 * `import()` after `jest.resetModules()`, since this file's whole
 * subject IS the real `config/index.js` module).
 *
 * `connectorCredentialCipher.js` derives its AES-256 key from this value
 * via SHA-256, so unlike the JWT secrets there is no length/format
 * requirement to test beyond "present and not the known placeholder" —
 * confirmed directly in that module's own header comment ("any string
 * works as input").
 */

import { describe, test, expect, jest, afterEach } from '@jest/globals';

const CONFIG_MODULE_PATH = '../../../src/config/index.js';
const REAL_JWT_ACCESS_SECRET = 'a-real-unique-production-secret-value-123';
const REAL_JWT_REFRESH_SECRET = 'another-real-unique-production-secret-456';
const REAL_CONNECTOR_KEY = 'a-real-unique-connector-encryption-key-789';
const DEV_ONLY_CONNECTOR_KEY = 'dev-only-connector-config-key-change-me';

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

/** Every test here sets both JWT secrets to real values, so only the connector key varies. */
function setRealJwtSecrets() {
  setEnv('JWT_ACCESS_SECRET', REAL_JWT_ACCESS_SECRET);
  setEnv('JWT_REFRESH_SECRET', REAL_JWT_REFRESH_SECRET);
}

describe('config/index.js — CONNECTOR_CONFIG_ENCRYPTION_KEY production preflight guard', () => {
  test('NODE_ENV=production with the key missing entirely (empty string) refuses to load', async () => {
    setEnv('NODE_ENV', 'production');
    setRealJwtSecrets();
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', '');
    jest.resetModules();

    await expect(import(CONFIG_MODULE_PATH)).rejects.toThrow(
      /CONNECTOR_CONFIG_ENCRYPTION_KEY/,
    );
  });

  test('NODE_ENV=production with the key still at its known development placeholder refuses to load', async () => {
    setEnv('NODE_ENV', 'production');
    setRealJwtSecrets();
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', DEV_ONLY_CONNECTOR_KEY);
    jest.resetModules();

    await expect(import(CONFIG_MODULE_PATH)).rejects.toThrow(
      /CONNECTOR_CONFIG_ENCRYPTION_KEY/,
    );
  });

  test('NODE_ENV=production with a real key set (alongside real JWT secrets) boots successfully', async () => {
    setEnv('NODE_ENV', 'production');
    setRealJwtSecrets();
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', REAL_CONNECTOR_KEY);
    jest.resetModules();

    const { default: config } = await import(CONFIG_MODULE_PATH);
    expect(config.isProduction).toBe(true);
    expect(config.security.connectorConfigEncryptionKey).toBe(
      REAL_CONNECTOR_KEY,
    );
  });

  test('a production boot that is otherwise safe (real JWT secrets) still refuses to start on the connector-key placeholder alone', async () => {
    setEnv('NODE_ENV', 'production');
    setRealJwtSecrets();
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', DEV_ONLY_CONNECTOR_KEY);
    jest.resetModules();

    let caught;
    try {
      await import(CONFIG_MODULE_PATH);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toMatch(/CONNECTOR_CONFIG_ENCRYPTION_KEY/);
    expect(caught.message).not.toMatch(/JWT_ACCESS_SECRET/);
    expect(caught.message).not.toMatch(/JWT_REFRESH_SECRET/);
  });

  test("NODE_ENV=test (this suite's own real environment) boots successfully with no connector key set at all — development/test convenience is unaffected", async () => {
    setEnv('NODE_ENV', 'test');
    delete process.env.CONNECTOR_CONFIG_ENCRYPTION_KEY;
    jest.resetModules();

    const { default: config } = await import(CONFIG_MODULE_PATH);
    expect(config.isProduction).toBe(false);
    expect(config.security.connectorConfigEncryptionKey).toBe(
      DEV_ONLY_CONNECTOR_KEY,
    );
  });

  test('the failure message names the variable and explains the consequence, but never prints any secret value — including the real, valid JWT secrets present in the very same environment', async () => {
    setEnv('NODE_ENV', 'production');
    setEnv('JWT_ACCESS_SECRET', 'super-secret-access-value-do-not-leak-1');
    setEnv('JWT_REFRESH_SECRET', 'super-secret-refresh-value-do-not-leak-2');
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', DEV_ONLY_CONNECTOR_KEY);
    jest.resetModules();

    let caught;
    try {
      await import(CONFIG_MODULE_PATH);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    // Actionable: names the offending variable and says what to do.
    expect(caught.message).toMatch(/CONNECTOR_CONFIG_ENCRYPTION_KEY/);
    expect(caught.message).toMatch(/set a real, unique value/i);
    // Never the placeholder value itself, and never a real secret value
    // that happens to be sitting in the same process environment —
    // the guard's own construction never interpolates any `value`,
    // only variable `name`s and fixed prose, and this asserts that
    // holds for the actual thrown message, not just the source code.
    expect(caught.message).not.toContain(DEV_ONLY_CONNECTOR_KEY);
    expect(caught.message).not.toContain(
      'super-secret-access-value-do-not-leak-1',
    );
    expect(caught.message).not.toContain(
      'super-secret-refresh-value-do-not-leak-2',
    );
  });

  test('a real key of arbitrary (non-32-byte) length is accepted — SHA-256 derivation means no format/length requirement exists', async () => {
    setEnv('NODE_ENV', 'production');
    setRealJwtSecrets();
    setEnv('CONNECTOR_CONFIG_ENCRYPTION_KEY', 'short-but-real');
    jest.resetModules();

    const { default: config } = await import(CONFIG_MODULE_PATH);
    expect(config.isProduction).toBe(true);
    expect(config.security.connectorConfigEncryptionKey).toBe('short-but-real');
  });
});
