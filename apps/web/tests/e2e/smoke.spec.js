/**
 * Sprint 1's baseline E2E smoke test — proves the full pipeline (real
 * Vite dev server, real browser, real routing) works end-to-end before
 * any real user journey exists to test.
 */

import { test, expect } from '@playwright/test';

test('root redirects to the default locale and renders the placeholder page', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/hy$/);
  await expect(page.locator('h1')).toContainText('Travel Hub Armenia');
});

test('switching to an unsupported locale segment shows 404', async ({
  page,
}) => {
  await page.goto('/xx');
  await expect(page.locator('h1')).toContainText('404');
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
