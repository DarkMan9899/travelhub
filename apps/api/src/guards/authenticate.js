/**
 * Authentication (populate-only) middleware.
 *
 * Implements `BACKEND_ARCHITECTURE.md` §11's fixed middleware order:
 * runs globally, right after request context and before rate limiting,
 * on every request — but never rejects. It only resolves and attaches
 * `req.principal` when a valid `Authorization: Bearer` token is present;
 * a missing/invalid token simply leaves `req.principal` undefined, so
 * public routes are unaffected. `requireAuth.js` is what actually
 * rejects an unauthenticated request on protected routes.
 *
 * Verifies the access token's signature/expiry only (Ch.12: no database
 * round-trip) via the shared `core/domain/tokenService.js`. The token
 * payload carries `{ sub, roles, partnerId }` — role *codes* (e.g.
 * `"CUSTOMER"`), not raw numeric role IDs (Sprint 6 decision, see
 * docs/SPRINT_6_AUTH_FOUNDATION.md), so `requireRole` can check them
 * statelessly with no extra lookup.
 */

import { verifyAccessToken } from '../core/domain/tokenService.js';

const BEARER_PREFIX = 'Bearer ';

export default function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (typeof header === 'string' && header.startsWith(BEARER_PREFIX)) {
    const token = header.slice(BEARER_PREFIX.length).trim();
    try {
      const payload = verifyAccessToken(token);
      req.principal = {
        userId: payload.sub,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
        partnerId: payload.partnerId ?? null,
      };
    } catch {
      // Invalid/expired token on a request that may hit a public route —
      // never reject here; requireAuth.js handles rejection where needed.
    }
  }

  next();
}
