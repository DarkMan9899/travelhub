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
 *
 * Stage 11.2 (Partner Management): `requirePermission` accepts more than
 * one key (`requirePermission('partner.verify', 'partner.moderate')`) —
 * granted if the principal has ANY of them. Every pre-existing call site
 * passes exactly one key, so this is purely additive; a single-key call
 * behaves exactly as before.
 */

import { AuthenticationError, AuthorizationError } from '../errors/AppError.js';

export function createRequirePermissionGuard(permissionResolver) {
  return function requirePermission(...permissionKeys) {
    return async (req, res, next) => {
      if (!req.principal) {
        next(new AuthenticationError());
        return;
      }
      try {
        const grants = await Promise.all(
          permissionKeys.map((key) =>
            permissionResolver.hasPermission(req.principal.roles, key),
          ),
        );
        if (!grants.some(Boolean)) {
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
