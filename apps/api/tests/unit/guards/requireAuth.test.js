/**
 * Sprint 6: "Auth middleware" / "Protected routes." `requireAuth` only
 * checks what `authenticate.js` already resolved onto `req.principal` —
 * exercised here with a plain mock request/response, no Express app
 * needed (BACKEND_ARCHITECTURE.md §55).
 */

import { describe, test, expect, jest } from '@jest/globals';
import requireAuth from '../../../src/guards/requireAuth.js';
import { AuthenticationError } from '../../../src/errors/AppError.js';

describe('requireAuth (src/guards/requireAuth.js)', () => {
  test('calls next() with no argument when req.principal is present', () => {
    const req = { principal: { userId: 1, roles: ['CUSTOMER'] } };
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  test('calls next(AuthenticationError) when req.principal is missing', () => {
    const req = {};
    const next = jest.fn();

    requireAuth(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(AuthenticationError);
  });
});
