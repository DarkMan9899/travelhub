/**
 * Rejects a request with no resolved principal.
 *
 * Implements `BACKEND_ARCHITECTURE.md` §13: a guard middleware resolves
 * the request's principal and rejects before any Controller code runs.
 * Must run after `authenticate.js` (global, `src/app.js`) — this guard
 * only checks what that middleware already resolved, it never re-parses
 * the token itself.
 */

import { AuthenticationError } from '../errors/AppError.js';

export default function requireAuth(req, res, next) {
  if (!req.principal) {
    next(new AuthenticationError());
    return;
  }
  next();
}
