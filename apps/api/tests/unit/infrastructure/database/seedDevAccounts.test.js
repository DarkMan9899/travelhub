/**
 * Launch-blocker remediation (P0-A): proves `seedDevAccounts` refuses to
 * run under `config.isProduction`, and makes zero database calls when it
 * does — i.e. zero fixed-credential dev accounts are ever created in a
 * production environment. Deliberately never touches `process.env` or a
 * real database; `config` is mocked at the module boundary so this stays
 * a pure unit test regardless of which environment Jest itself runs in.
 */

import { describe, test, expect, jest, afterEach } from '@jest/globals';

const CONFIG_MODULE_PATH = '../../../../src/config/index.js';
const SEED_MODULE_PATH =
  '../../../../src/infrastructure/database/seeds/005_dev_accounts.js';

afterEach(() => {
  jest.resetModules();
  jest.dontMock(CONFIG_MODULE_PATH);
});

describe('seedDevAccounts production guard (P0-A launch-blocker remediation)', () => {
  test('refuses with a loud error and makes zero connection calls when config.isProduction is true', async () => {
    jest.unstable_mockModule(CONFIG_MODULE_PATH, () => ({
      default: { isProduction: true },
    }));
    const { default: seedDevAccounts } = await import(SEED_MODULE_PATH);
    const connection = { query: jest.fn() };

    await expect(seedDevAccounts(connection)).rejects.toThrow(/production/i);
    expect(connection.query).not.toHaveBeenCalled();
  });

  test('the refusal error never includes the dev credential values', async () => {
    jest.unstable_mockModule(CONFIG_MODULE_PATH, () => ({
      default: { isProduction: true },
    }));
    const { default: seedDevAccounts } = await import(SEED_MODULE_PATH);
    const connection = { query: jest.fn() };

    let caught;
    try {
      await seedDevAccounts(connection);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeDefined();
    expect(caught.message).not.toMatch(/DevAdmin|DevVendor|DevCustomer/);
  });

  test('proceeds past the guard (does not refuse) when config.isProduction is false', async () => {
    jest.unstable_mockModule(CONFIG_MODULE_PATH, () => ({
      default: { isProduction: false },
    }));
    const { default: seedDevAccounts } = await import(SEED_MODULE_PATH);
    const marker = new Error('reached a real query past the guard');
    const connection = { query: jest.fn().mockRejectedValue(marker) };

    await expect(seedDevAccounts(connection)).rejects.toBe(marker);
    expect(connection.query).toHaveBeenCalled();
  });
});
