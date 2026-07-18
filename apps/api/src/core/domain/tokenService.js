/**
 * JWT base utility (Domain-layer port + a default implementation).
 *
 * Implements BACKEND_ARCHITECTURE.md §12 (Authentication): stateless,
 * short-lived access tokens verified by signature/expiry alone (no
 * database round-trip); refresh tokens are handled separately (they are
 * persisted/rotated server-side — that lifecycle belongs to the `auth`
 * module's Service layer once implemented, not to this base utility).
 *
 * Sprint 1 scope: the signing/verification primitives only. No login,
 * registration, or refresh-rotation business logic is implemented here
 * — see BACKEND_ARCHITECTURE.md Part XI, Module 2 (Auth) for that.
 */

import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { AuthenticationError } from '../../errors/AppError.js';

/**
 * Signs a short-lived access token.
 * @param {object} payload - minimal claims only: user id, role ids,
 *   partner scope if applicable (BACKEND_ARCHITECTURE.md §12).
 */
export function signAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiry,
  });
}

/**
 * Signs a refresh token. The caller (the `auth` module's Service layer,
 * once implemented) is responsible for persisting a hashed reference to
 * this token server-side to support rotation and reuse detection
 * (API_SPECIFICATION.md §7).
 */
export function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiry,
  });
}

/**
 * Verifies an access token's signature and expiry. Throws
 * AuthenticationError (never a raw jsonwebtoken error) on failure, so
 * callers only ever handle the platform's own Exception Hierarchy.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret);
  } catch {
    throw new AuthenticationError(
      'The access token is invalid or has expired.',
    );
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret);
  } catch {
    throw new AuthenticationError(
      'The refresh token is invalid or has expired.',
      'INVALID_REFRESH_TOKEN',
    );
  }
}

export default {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
