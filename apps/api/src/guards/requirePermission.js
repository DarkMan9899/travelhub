/**
 * `createRequirePermissionGuard(permissionResolver)` — guard factory.
 *
 * Implements `BACKEND_ARCHITECTURE.md` §13/§14: resolves the principal's
 * permissions (role codes -> permission keys, cached per
 * `API_SPECIFICATION.md` §18) and rejects with 403 `FORBIDDEN` before
 * any Controller code runs if the required key is absent.
 *
 * `createRequirePermissionGuard` is called ONCE at the composition root
 * (`src/app.js`) with the already-constructed `PermissionResolver` — this
 * file itself never imports infrastructure directly (crosscutting may
 * depend only on core + crosscutting); the resolver is injected as a
 * plain parameter, not imported.
 */

import { AuthenticationError, AuthorizationError } from '../errors/AppError.js';

export function createRequirePermissionGuard(permissionResolver) {
  return function requirePermission(permissionKey) {
    return async (req, res, next) => {
      if (!req.principal) {
        next(new AuthenticationError());
        return;
      }
      try {
        const granted = await permissionResolver.hasPermission(
          req.principal.roles,
          permissionKey,
        );
        if (!granted) {
          next(new AuthorizationError());
          return;
        }
        next();
      } catch (err) {
        next(err);
      }
    };
  };
}

export default createRequirePermissionGuard;
