/**
 * Sprint 1's `tokenService.js`, exercised for the first time by Sprint 6
 * (JWT access/refresh tokens). Confirms the sign/verify round-trip and
 * that every failure surfaces as `AuthenticationError`
 * (BACKEND_ARCHITECTURE.md §12), never a raw `jsonwebtoken` error.
 */

import { describe, test, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
} from '../../../../src/core/domain/tokenService.js';
import { AuthenticationError } from '../../../../src/errors/AppError.js';
import config from '../../../../src/config/index.js';

describe('tokenService (src/core/domain/tokenService.js)', () => {
  test('signAccessToken / verifyAccessToken round-trip preserves the payload', () => {
    const token = signAccessToken({
      sub: 42,
      roles: ['CUSTOMER'],
      partnerId: null,
    });
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe(42);
    expect(payload.roles).toEqual(['CUSTOMER']);
  });

  test('signRefreshToken / verifyRefreshToken round-trip preserves the payload', () => {
    const token = signRefreshToken({
      sub: 7,
      familyId: 'family-1',
      jti: 'jti-1',
    });
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe(7);
    expect(payload.familyId).toBe('family-1');
  });

  test('verifyAccessToken rejects a garbage string with AuthenticationError, never a raw jsonwebtoken error', () => {
    expect(() => verifyAccessToken('not-a-real-token')).toThrow(
      AuthenticationError,
    );
  });

  test('verifyRefreshToken rejects an expired token with code INVALID_REFRESH_TOKEN', () => {
    const expiredToken = jwt.sign({ sub: 1 }, config.jwt.refreshSecret, {
      expiresIn: '-1s',
    });
    try {
      verifyRefreshToken(expiredToken);
      throw new Error('expected verifyRefreshToken to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError);
      expect(err.code).toBe('INVALID_REFRESH_TOKEN');
    }
  });

  test('verifyAccessToken rejects a token signed with a different secret', () => {
    const foreignToken = jwt.sign({ sub: 1 }, 'a-completely-different-secret', {
      expiresIn: '15m',
    });
    expect(() => verifyAccessToken(foreignToken)).toThrow(AuthenticationError);
  });

  test('decodeToken reads a claim without verifying the signature', () => {
    const token = signRefreshToken({
      sub: 9,
      familyId: 'family-2',
      jti: 'jti-2',
    });
    const decoded = decodeToken(token);
    expect(decoded.sub).toBe(9);
    expect(typeof decoded.exp).toBe('number');
  });
});
