/**
 * Playwright global setup — flushes two Redis-backed, cross-cutting
 * counters once before the full E2E suite runs, both keyed in a way that's
 * shared across every spec file regardless of which one issued the
 * requests:
 *
 * 1. Rate-limit counters (`apps/api/src/middleware/rateLimiter.js`,
 *    keyspace prefix `ratelimit:`). `express-rate-limit`'s key generator
 *    is IP-based, not per-test-file — every request from this machine
 *    shares one Redis bucket per tier. The `ai` tier (Stage 15.0's
 *    `aiRateLimiter`, a deliberately hardcoded 20/min cost-control
 *    ceiling, never raised for testing) is the tightest: `ai.spec.js`
 *    alone makes several real AI-gateway calls, and running it alongside
 *    every other spec in one `fullyParallel` run can otherwise exhaust
 *    that budget before `ai.spec.js`'s own tests get their turn.
 *
 * 2. Login-attempt lockout counters (`LoginAttemptTracker`, keyspace
 *    prefix `session:login_attempts:`) — 5 failures within 15 minutes
 *    locks that email out (`ACCOUNT_LOCKED`, 423), keyed by account, not
 *    IP. `auth.spec.js`'s deliberate "wrong password" test (and any
 *    other spec's failed-login assertions) run against the same shared
 *    demo/dev accounts every other spec logs into — without a flush here,
 *    those failures can push a real account over the 5-attempt threshold
 *    and lock out every unrelated spec that needs that account for the
 *    rest of the run. Found via a real cascading-failure investigation,
 *    not a hypothetical: a full-suite run without this flush showed the
 *    exact `ACCOUNT_LOCKED` (423) signature across nearly every spec that
 *    logs in.
 *
 * Mirrors `apps/api/tests/integration/helpers/resetRateLimits.js`'s
 * identical fix for the backend integration suite (same two prefixes).
 *
 * 0. API test-mode guard. This suite's `webServer` block (playwright.
 *    config.js) only starts the frontend (`npm run dev`, Vite) — the API
 *    server is a separate process a developer starts manually, and
 *    nothing here controls which database it's pointed at. `npm run
 *    test:e2e` (package.json) resets `travelhub_test` before this file
 *    even runs, but that's a no-op safety measure if the already-running
 *    API server is still in `development` mode talking to `travelhub_
 *    dev` — exactly what caused the real incident documented in
 *    `./README.md` (38 stale users / 19 stale partners accumulated in
 *    `travelhub_dev`). Failing fast here, before any spec runs, catches
 *    that regardless of how this file was invoked (bare `npx playwright
 *    test`, an IDE test runner, etc. — anything that bypasses the
 *    package.json script).
 *
 * 3. Vite dev-server route warm-up. The actual root cause behind the
 *    flake this was originally written to chase turned out to be local
 *    machine CPU contention under Playwright's default worker count —
 *    see `playwright.config.js`'s `workers` comment for the full
 *    evidence trail (concurrent logins tested clean at the API level via
 *    `curl`, the same test passed reliably alone, only failed alongside
 *    several others). That's the real, confirmed fix. This warm-up stays
 *    as a cheap, harmless belt-and-suspenders addition: Vite dev still
 *    compiles each route's modules on first request, and forcing that
 *    for the two most-visited routes here — before the parallel run
 *    starts, while nothing is competing for the compile — means no
 *    worker's first real test pays that one-time cost under contention.
 */

import { chromium } from '@playwright/test';
import Redis from 'ioredis';

const API_HEALTH_URL = 'http://localhost:4000/health/live';

async function assertApiIsInTestMode() {
  let body;
  try {
    const res = await fetch(API_HEALTH_URL);
    body = await res.json();
  } catch (err) {
    throw new Error(
      `E2E setup: could not reach the API's health check at ${API_HEALTH_URL} ` +
        `(${err.message}). Start the API server with NODE_ENV=test before ` +
        `running this suite — see tests/e2e/README.md.`,
    );
  }
  if (body?.data?.environment !== 'test') {
    throw new Error(
      `E2E setup: refusing to run — the API server at ${API_HEALTH_URL} is ` +
        `reporting environment "${body?.data?.environment}", not "test". ` +
        `Running this suite against a non-test API permanently writes ` +
        `throwaway users/partners into its database (see tests/e2e/README.md). ` +
        `Restart the API with NODE_ENV=test and run "npm run db:reset:test" first.`,
    );
  }
}

export default async function globalSetup(config) {
  await assertApiIsInTestMode();

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    const keys = (
      await Promise.all([
        redis.keys('ratelimit:*'),
        redis.keys('session:login_attempts:*'),
      ])
    ).flat();
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Redis unavailable — the app's own rate limiter already fails open
    // in that case (see `failOpenOnStoreError` in rateLimiter.js), and
    // `LoginAttemptTracker` fails open too (never blocks login on a
    // tracker outage); a stale/unreachable counter here is likewise not
    // worth failing the whole E2E run over.
  } finally {
    redis.disconnect();
  }

  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:5173';
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Home and the login form are the two routes almost every spec
    // reaches first — warming both, sequentially, covers the actual
    // race observed without trying to enumerate every route.
    await page.goto(`${baseURL}/en`, { waitUntil: 'domcontentloaded' });
    await page.goto(`${baseURL}/en/auth/login`, {
      waitUntil: 'domcontentloaded',
    });
    await page
      .getByRole('button', { name: 'Log in' })
      .waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    // Best-effort warm-up — if this fails for any reason, the parallel
    // run still proceeds; worst case is a reversion to the pre-fix cold-
    // start behavior, not a broken run.
  } finally {
    await browser.close();
  }
}
