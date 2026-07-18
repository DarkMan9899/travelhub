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
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
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
