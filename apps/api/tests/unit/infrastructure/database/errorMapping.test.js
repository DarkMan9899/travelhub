/**
 * Sprint 5 §3: "database error mapping." A Repository must never let a
 * raw mysql2 driver error escape (BACKEND_ARCHITECTURE.md §23-24) — these
 * tests pin the mapping for every error code this module claims to
 * translate.
 */

import { describe, test, expect } from '@jest/globals';
import {
  mapMysqlError,
  isMysqlDriverError,
} from '../../../../src/infrastructure/database/errorMapping.js';
import {
  ConflictError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

function driverError(code) {
  const err = new Error(`simulated ${code}`);
  err.code = code;
  return err;
}

describe('MySQL error mapping (src/infrastructure/database/errorMapping.js)', () => {
  test('ER_DUP_ENTRY maps to ConflictError', () => {
    expect(mapMysqlError(driverError('ER_DUP_ENTRY'))).toBeInstanceOf(
      ConflictError,
    );
  });

  test.each([
    'ER_NO_REFERENCED_ROW',
    'ER_NO_REFERENCED_ROW_2',
    'ER_ROW_IS_REFERENCED',
    'ER_ROW_IS_REFERENCED_2',
  ])('%s maps to ValidationError', (code) => {
    expect(mapMysqlError(driverError(code))).toBeInstanceOf(ValidationError);
  });

  test.each([
    'ER_DATA_TOO_LONG',
    'ER_BAD_NULL_ERROR',
    'ER_TRUNCATED_WRONG_VALUE',
    'ER_WARN_DATA_OUT_OF_RANGE',
  ])('%s maps to ValidationError', (code) => {
    expect(mapMysqlError(driverError(code))).toBeInstanceOf(ValidationError);
  });

  test('an unrecognized driver error code passes through unchanged', () => {
    const original = driverError('ER_SOME_UNMAPPED_CODE');
    expect(mapMysqlError(original)).toBe(original);
  });

  test('a non-driver error (no .code) passes through unchanged', () => {
    const plain = new Error('not a driver error');
    expect(mapMysqlError(plain)).toBe(plain);
  });

  test('isMysqlDriverError only recognizes ER_-prefixed codes', () => {
    expect(isMysqlDriverError(driverError('ER_DUP_ENTRY'))).toBe(true);
    expect(isMysqlDriverError(new Error('plain'))).toBe(false);
    expect(isMysqlDriverError(null)).toBe(false);
  });
});
