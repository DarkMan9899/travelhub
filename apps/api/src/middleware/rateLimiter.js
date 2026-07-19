/**
 * Rate-limit foundation.
 *
 * Implements BACKEND_ARCHITECTURE.md §48: Redis-backed (the `ratelimit:`
 * keyspace reserved in src/infrastructure/cache/redisClient.js), enforced
 * at middleware level before any Controller code runs, tiers configured
 * centrally through src/config/index.js rather than hardcoded per route.
 *
 * Sprint 5 scope: the tiered limiter factory plus a global baseline
 * (`publicRateLimiter`, applied platform-wide in app.js). Per-route
 * `authenticatedRateLimiter`/`sensitiveRateLimiter` overrides are wired in
 * by each module's `module.routes.js` once Auth (Module 2) exists to
 * resolve a request's principal — there is no principal to key on yet.
 */

import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import config from '../config/index.js';
import {
  getRedisClient,
  REDIS_KEY_PREFIXES,
} from '../infrastructure/cache/redisClient.js';
import { RateLimitError } from '../errors/AppError.js';
import { getModuleLogger } from '../logging/logger.js';

const log = getModuleLogger('middleware:rateLimiter');

/**
 * Rate limiting must never become a single point of failure for the
 * whole API: if Redis is unreachable *during* a request (as opposed to
 * at boot, handled by preventPrematureCrash below), `RedisStore.increment`
 * throws, and express-rate-limit's internal `handleAsyncErrors` wrapper
 * turns that into `next(err)` — which, left unhandled, would reach the
 * global error handler as a raw 500 for every single request. A rate
 * limiter's own infrastructure failing is not a reason to fail the
 * request; only a genuine over-limit (`RateLimitError`, thrown
 * deliberately via the `handler` option below) should reach the client.
 * This wrapper intercepts anything else and fails OPEN.
 */
function failOpenOnStoreError(limiter, label) {
  return (req, res, next) => {
    limiter(req, res, (err) => {
      if (!err) {
        next();
        return;
      }
      if (err instanceof RateLimitError) {
        next(err);
        return;
      }
      const requestLog = req.log ?? log;
      requestLog.warn(
        { err, limiter: label },
        'Rate limiter store unavailable — failing open',
      );
      next();
    });
  };
}

/**
 * `RedisStore`'s constructor fires two unawaited `SCRIPT LOAD` commands
 * (`incrementScriptSha`/`getScriptSha`) and stores the pending promises as
 * instance properties. If Redis is unreachable at that moment and no HTTP
 * request arrives before Node's microtask checkpoint, those promises are
 * flagged as unhandled rejections and crash the whole process — well
 * before `GET /health/ready` would ever report Redis as down. Attaching a
 * no-op `.catch()` here only silences that premature crash; it does not
 * interfere with `RedisStore`'s own internal retry/error-handling (Ch.42),
 * which independently awaits the same promise reference on first real use.
 */
function preventPrematureCrash(store) {
  store.incrementScriptSha?.catch(() => {});
  store.getScriptSha?.catch(() => {});
  return store;
}

function createRateLimiter({ max, prefix }) {
  return rateLimit({
    windowMs: 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    store: preventPrematureCrash(
      new RedisStore({
        prefix: `${REDIS_KEY_PREFIXES.RATE_LIMIT}${prefix}:`,
        sendCommand: (...args) => getRedisClient().call(...args),
      }),
    ),
    handler: (req, res, next) => {
      next(new RateLimitError());
    },
  });
}

/** Unauthenticated/public traffic — the global baseline applied in app.js. */
export const publicRateLimiter = failOpenOnStoreError(
  createRateLimiter({
    max: config.rateLimit.publicPerMinute,
    prefix: 'public',
  }),
  'public',
);

/** Standard authenticated traffic — applied per-route once Auth exists. */
export const authenticatedRateLimiter = failOpenOnStoreError(
  createRateLimiter({
    max: config.rateLimit.authenticatedPerMinute,
    prefix: 'authenticated',
  }),
  'authenticated',
);

/** Login, password reset, coupon-redemption-class sensitive endpoints. */
export const sensitiveRateLimiter = failOpenOnStoreError(
  createRateLimiter({
    max: config.rateLimit.sensitivePerMinute,
    prefix: 'sensitive',
  }),
  'sensitive',
);

export default publicRateLimiter;
