/**
 * Sprint 6: "Roles: Customer, Host, Admin" / "Route authorization
 * middleware." `requireRole` is stateless — it only reads
 * `req.principal.roles`, already resolved from the JWT by
 * `authenticate.js` (BACKEND_ARCHITECTURE.md §12: no database
 * round-trip for a role check).
 */

import { describe, test, expect, jest } from '@jest/globals';
import { requireRole } from '../../../src/guards/requireRole.js';
import {
  AuthenticationError,
  AuthorizationError,
} from '../../../src/errors/AppError.js';

describe('requireRole (src/guards/requireRole.js)', () => {
  test('calls next() when the principal holds one of the required roles', () => {
    const req = { principal: { userId: 1, roles: ['ADMIN'] } };
    const next = jest.fn();

    requireRole('ADMIN', 'SUPER_ADMIN')(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('calls next(AuthorizationError) when the principal holds none of the required roles', () => {
    const req = { principal: { userId: 1, roles: ['CUSTOMER'] } };
    const next = jest.fn();

    requireRole('ADMIN', 'SUPER_ADMIN')(req, {}, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(AuthorizationError);
  });

  test('calls next(AuthenticationError) when there is no principal at all', () => {
    const req = {};
    const next = jest.fn();

    requireRole('ADMIN')(req, {}, next);

    expect(next.mock.calls[0][0]).toBeInstanceOf(AuthenticationError);
  });
});
