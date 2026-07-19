/**
 * MySQL driver error -> AppError mapping.
 *
 * Implements BACKEND_ARCHITECTURE.md §23-24: a Repository never lets a
 * raw `mysql2` driver error (or its driver-specific message/stack) escape
 * to a Service/Controller — every foreseeable constraint violation is
 * translated here, once, into the platform's Exception Hierarchy
 * (`src/errors/AppError.js`), instead of every Repository re-implementing
 * its own `try/catch` mapping.
 *
 * Usage inside a Repository implementation:
 *   try {
 *     await connection.query('INSERT INTO users (...) VALUES (...)', [...]);
 *   } catch (err) {
 *     throw mapMysqlError(err);
 *   }
 */

import { ConflictError, ValidationError } from '../../errors/AppError.js';

const DUPLICATE_KEY_CODES = new Set(['ER_DUP_ENTRY']);

const FOREIGN_KEY_CODES = new Set([
  'ER_NO_REFERENCED_ROW',
  'ER_NO_REFERENCED_ROW_2',
  'ER_ROW_IS_REFERENCED',
  'ER_ROW_IS_REFERENCED_2',
]);

const DATA_SHAPE_CODES = new Set([
  'ER_DATA_TOO_LONG',
  'ER_BAD_NULL_ERROR',
  'ER_TRUNCATED_WRONG_VALUE',
  'ER_WARN_DATA_OUT_OF_RANGE',
]);

export function isMysqlDriverError(err) {
  return (
    Boolean(err) && typeof err.code === 'string' && err.code.startsWith('ER_')
  );
}

/**
 * Returns an `AppError` for every known-mappable `mysql2` error code, or
 * the original error unchanged when the code is unrecognized — an
 * unmapped error still reaches the global error handler
 * (`src/middleware/errorHandler.js`) and surfaces as `INTERNAL_ERROR`,
 * never a raw driver message leaked to the client.
 */
export function mapMysqlError(err) {
  if (!isMysqlDriverError(err)) return err;

  if (DUPLICATE_KEY_CODES.has(err.code)) {
    return new ConflictError('This record already exists.');
  }
  if (FOREIGN_KEY_CODES.has(err.code)) {
    return new ValidationError(
      'This request references a record that does not exist.',
    );
  }
  if (DATA_SHAPE_CODES.has(err.code)) {
    return new ValidationError('One or more fields are invalid.');
  }
  return err;
}

export default mapMysqlError;
