/**
 * Playwright configuration.
 * Implements FRONTEND_ARCHITECTURE.md §35: E2E tests against a real,
 * running build — full user journeys in future sprints (search → hold →
 * payment → confirmation, per §35.1's required scenarios). Sprint 1
 * wires the harness against the one real placeholder route only.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/globalSetup.js',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  // 2026 SEO/performance audit — root-caused a real, machine-specific
  // flake: a login-involving test would occasionally never get past the
  // login form, but ONLY when run alongside several other login-
  // involving tests in Playwright's default (CPU-core-count) worker
  // pool — the same test passed reliably every time run alone. Directly
  // ruled out the backend as the cause: 4 truly concurrent `POST /auth/
  // login` requests for the same account, fired via `curl &`, all
  // returned 200 in under 350ms with independent, non-colliding
  // sessions — the API handles real concurrency correctly. What's left
  // is this local machine running out of CPU to render/hydrate several
  // Chromium instances at once on top of everything else active this
  // session — capping workers locally (never in CI, which has its own
  // resourcing) is the honest fix for a resource ceiling, not a
  // workaround for an app bug.
  workers: process.env.CI ? undefined : 2,
  reporter: 'html',
  // A cold `npm run dev` webServer can still take a beat to finish its
  // first on-demand compile of a given route on top of the above — a
  // slightly longer default assertion timeout absorbs that safely.
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
