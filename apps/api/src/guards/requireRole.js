/**
 * `requireRole(...roleCodes)` guard factory.
 *
 * Rejects a request whose principal holds none of the given global role
 * codes. Stateless — reads only `req.principal.roles`, already resolved
 * from the JWT by `authenticate.js`; no database round-trip
 * (`BACKEND_ARCHITECTURE.md` §12).
 */

import { AuthenticationError, AuthorizationError } from '../errors/AppError.js';

export function requireRole(...roleCodes) {
  return (req, res, next) => {
    if (!req.principal) {
      next(new AuthenticationError());
      return;
    }
    const hasRole = roleCodes.some((code) =>
      req.principal.roles.includes(code),
    );
    if (!hasRole) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
}

export default requireRole;
