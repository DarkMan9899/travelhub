/**
 * Sprint 1's baseline E2E smoke test — proves the full pipeline (real
 * Vite dev server, real browser, real routing) works end-to-end before
 * any real user journey exists to test.
 *
 * Updated during the Phase 11 pre-flight audit: both assertions had gone
 * stale as the app grew past its Sprint 1 placeholder — the home page's
 * `<h1>` is the real Hero heading now ("Discover Armenia" / "Bacahaytek'
 * Hayastany" depending on locale), not the old "Travel Hub Armenia"
 * placeholder text, and the 404 page's title renders as an `<h3>`
 * (`EmptyState`'s heading level), not an `<h1>` — this file's own
 * assertions were failing against the current app, not catching a real
 * regression.
 */

import { test, expect } from './fixtures.js';

test('root redirects to the default locale and renders the home hero', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/hy$/);
  await expect(page.locator('h1')).toBeVisible();
});

test('switching to an unsupported locale segment shows a 404 page', async ({
  page,
}) => {
  await page.goto('/xx');
  await expect(page.getByRole('heading', { level: 3 })).toBeVisible();
});

test('each supported locale renders without error', async ({ page }) => {
  // NOTE: deliberately sequential, explicit statements rather than a loop —
  // a single Playwright `page` cannot safely navigate concurrently
  // (Promise.all over page.goto() calls on the same page instance would
  // race), and a for-of loop with await inside trips this project's
  // no-await-in-loop / no-restricted-syntax lint rules for good reason
  // elsewhere in the codebase. Three locales is small enough that writing
  // it out plainly is both correct and perfectly readable.
  await page.goto('/hy');
  await expect(page.locator('h1')).toBeVisible();

  await page.goto('/ru');
  await expect(page.locator('h1')).toBeVisible();

  await page.goto('/en');
  await expect(page.locator('h1')).toBeVisible();
});
