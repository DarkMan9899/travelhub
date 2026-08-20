/**
 * P1.5 (Master Roadmap, Review Trust & Safety): end-to-end report ->
 * moderate flow against the real backend + dev-seeded database. Uses an
 * already-seeded, published listing's existing review (`demo-tours-
 * modern-sevan-tour`, id 37 — has exactly one seeded review) rather than
 * building a fresh booking-to-review journey through the UI, which
 * `partnerProfile.spec.js`-style specs already exercise elsewhere and
 * the backend integration suite (`reviewModeration.test.js`) covers in
 * full — this spec's job is proving the REPORT and MODERATE UI surfaces
 * actually work end to end, not re-proving the booking flow.
 */

import { test, expect, resetRateLimits } from './fixtures.js';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}@example.com`;
}

async function registerNewUser(page, prefix) {
  const email = uniqueEmail(prefix);
  await page.goto('/en/auth/register');
  await page.getByLabel('First name').fill('Test');
  await page.getByLabel('Last name').fill('User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('StrongPass!2024');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/en\/account$/);
  return email;
}

async function logout(page) {
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/en$/);
}

async function loginAsDevAdmin(page) {
  await page.goto('/en/auth/login');
  await page.getByLabel('Email').fill('admin@travelhub.dev');
  await page.getByLabel('Password').fill('DevAdmin!2024');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/en\/admin$/);
}

test.describe('Review report and moderation — happy path', () => {
  test('a customer reports an existing review, and an admin sees and rejects it', async ({
    page,
  }) => {
    await registerNewUser(page, 'e2e-review-reporter');
    await resetRateLimits();

    await page.goto('/en/listings/37');
    // Scoped to the target review's own card via its full, distinguishing
    // sentence — this seeded listing can carry more than one review (a
    // shared fixture other runs/seed passes may have added to), so a
    // bare "Report" button lookup is ambiguous; `.last()` on a `hasText`
    // filter resolves to the innermost (smallest) matching container,
    // i.e. this one review's own card, not a page-level ancestor.
    const reviewCard = page
      .locator('div')
      .filter({
        hasText:
          'Everything was exactly as described, and the host was very responsive',
      })
      .last();
    await expect(reviewCard).toBeVisible();

    await reviewCard.getByRole('button', { name: 'Report' }).click();
    await page
      .getByLabel('Additional details (optional)')
      .fill('This looks templated across many listings.');
    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByText("Thanks — we'll take a look.")).toBeVisible();

    await logout(page);
    await resetRateLimits();
    await loginAsDevAdmin(page);

    await page.getByRole('link', { name: 'Reviews' }).click();
    await expect(page).toHaveURL(/\/en\/admin\/reviews$/);

    // Default filter is "Reported only" — the just-reported review
    // should already be in view.
    await expect(
      page.getByText('Everything was exactly as described'),
    ).toBeVisible();
    await page.getByRole('button', { name: /Reports \(/ }).click();
    // Reports are permanent, append-only records — a prior run of this
    // same spec against this same shared fixture can leave an earlier
    // report with identical details text still present, so `.first()`
    // (existence of at least one matching report), not a unique match.
    await expect(
      page.getByText('This looks templated across many listings.').first(),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Reject' }).first().click();
    await page
      .getByLabel('Notes (optional)')
      .fill('Confirmed duplicate/templated content across listings.');
    await page.getByRole('button', { name: 'Reject' }).last().click();
    await expect(page.getByText('Review rejected.')).toBeVisible();

    await page.goto('/en/listings/37');
    await expect(
      page.getByText('Everything was exactly as described'),
    ).not.toBeVisible();

    // Restore the shared seeded fixture to how this test found it —
    // otherwise a second run (or any other spec/manual browsing relying
    // on this listing showing its seeded review) would find it
    // permanently hidden. Still shown in the "Reported only" queue
    // (the report itself isn't undone, only the moderation outcome).
    await page.goto('/en/admin/reviews');
    const restoredCard = page
      .locator('div')
      .filter({
        hasText:
          'Everything was exactly as described, and the host was very responsive',
      })
      .last();
    await restoredCard.getByRole('button', { name: 'Approve' }).click();
    // Approve asks for confirmation too (no extra input needed, unlike
    // Reject) — the dialog's own confirm button shares the same label.
    await page.getByRole('button', { name: 'Approve' }).last().click();
    await expect(page.getByText('Review approved.')).toBeVisible();
  });
});
