/**
 * `createRequireHostGuard(checkIsHost)` — guard factory.
 *
 * Sprint 6's "Host" role, mapped onto the existing partner-scoped
 * `OWNER` role rather than a new global role (see plan's Architecture
 * Decisions #1 — `API_SPECIFICATION.md` §32-33 protects exactly seven
 * seeded roles, none named "Host"). Checks whether the authenticated
 * principal is an `OWNER` of the partner identified by
 * `req.params.partnerId`, or of *any* partner when no `partnerId` route
 * param exists.
 *
 * No Sprint 6 route mounts this guard yet — no partner-scoped endpoint
 * exists (Sprint 6 is Auth/Users only). Built and integration-tested
 * standalone, ready for the Partner/Vendor Dashboard sprint. `checkIsHost`
 * is injected (see `src/infrastructure/database/repositories/
 * partnerEmployeeRepository.js`'s `isPartnerOwner`) rather than imported
 * directly, for the same crosscutting-layer-boundary reason as
 * `requirePermission.js`.
 */

import { AuthenticationError, AuthorizationError } from '../errors/AppError.js';

export function createRequireHostGuard(checkIsHost) {
  return async function requireHost(req, res, next) {
    if (!req.principal) {
      next(new AuthenticationError());
      return;
    }
    try {
      const partnerId = req.params.partnerId
        ? Number(req.params.partnerId)
        : null;
      const isHost = await checkIsHost(req.principal.userId, partnerId);
      if (!isHost) {
        next(
          new AuthorizationError(
            'You must be a Host (partner owner) to perform this action.',
          ),
        );
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export default createRequireHostGuard;
