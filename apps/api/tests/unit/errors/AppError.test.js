/**
 * Sprint 1 scope: this test exists purely to prove the unit-test harness
 * itself works end-to-end (Jest projects config, ESM support) before any
 * real business logic exists to test. It exercises the one piece of real
 * logic Sprint 1 introduces: the Exception Hierarchy
 * (BACKEND_ARCHITECTURE.md §24).
 */

import { describe, test, expect } from '@jest/globals';
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  LockedError,
} from '../../../src/errors/AppError.js';

describe('Exception Hierarchy (BACKEND_ARCHITECTURE.md §24)', () => {
  test('AppError defaults to a 500 INTERNAL_ERROR', () => {
    const err = new AppError('something broke');
    expect(err.httpStatus).toBe(500);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err).toBeInstanceOf(Error);
  });

  test('ValidationError maps to 422 VALIDATION_FAILED with details', () => {
    const details = [{ field: 'email', issue: 'required' }];
    const err = new ValidationError('Invalid input', details);
    expect(err.httpStatus).toBe(422);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.details).toEqual(details);
  });

  test('NotFoundError maps to 404 NOT_FOUND by default', () => {
    const err = new NotFoundError();
    expect(err.httpStatus).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });

  test('ConflictError supports a module-specific code (e.g. HOLD_EXPIRED)', () => {
    const err = new ConflictError('The hold has expired.', 'HOLD_EXPIRED');
    expect(err.httpStatus).toBe(409);
    expect(err.code).toBe('HOLD_EXPIRED');
  });

  test('every subclass is an instanceof AppError', () => {
    expect(new ValidationError()).toBeInstanceOf(AppError);
    expect(new NotFoundError()).toBeInstanceOf(AppError);
    expect(new ConflictError()).toBeInstanceOf(AppError);
  });

  test('LockedError (Sprint 6) maps to 423 ACCOUNT_LOCKED by default', () => {
    const err = new LockedError();
    expect(err.httpStatus).toBe(423);
    expect(err.code).toBe('ACCOUNT_LOCKED');
    expect(err).toBeInstanceOf(AppError);
  });
});
