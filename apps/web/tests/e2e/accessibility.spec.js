/**
 * Phase 11 pre-flight verification: automated accessibility scans
 * (`@axe-core/playwright`) on representative pages — home, search,
 * listing detail, and the partner dashboard — against the real backend +
 * demo-seeded test database. This is new *test tooling*, not a product
 * feature: no automated a11y scanning existed anywhere in this repo
 * before (only lint-time `eslint-plugin-jsx-a11y`), despite Phase 10.8
 * having done a manual responsive/a11y pass.
 *
 * Scoped to the "serious"/"critical" impact levels: axe's "minor"/
 * "moderate" findings include many subjective/heuristic checks not
 * worth failing a CI gate over; serious/critical are the ones that
 * actually block a screen-reader/keyboard user.
 */

import AxeBuilder from '@axe-core/playwright';
import { test, expect, request as playwrightRequest } from './fixtures.js';

// Every `packages/ui` overlay/transition (EmptyState, Drawer, Modal, ...)
// implements `reduced-motion-safe` (tokens/_motion.scss), which collapses
// its animation/transition durations to ~0 under `prefers-reduced-motion:
// reduce`. Without this, a scan that lands mid fade-in samples a
// transient, lighter-than-final foreground color — e.g. EmptyState's
// description text measured at a failing 4.38:1 mid-fade even though its
// settled color (`$color-gray-600` on white) is a real 5.78:1 — a false
// positive from test timing, not the product's actual rendered state.
test.use({ reducedMotion: 'reduce' });

// `reducedMotion: 'reduce'` (above) collapses every `reduced-motion-safe`
// animation/transition to ~0.01ms (tokens/_motion.scss) rather than
// literally 0 — real, if rare, event-loop timing can still land axe's
// synchronous style snapshot inside that ~10-microsecond window mid-fade
// (see this file's own header comment: EmptyState's description text has
// been caught this way before, at a failing ~3.7-4.4:1 contrast even
// though its settled color is a real ~5.8:1). Forcing every animation/
// transition to a literal, unconditional 0s here — for the scan only,
// never for the product's own CSS — closes that residual race instead of
// merely narrowing it, without touching what the assertion checks.
async function settleAnimations(page) {
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }',
  });
}

async function seriousOrCriticalViolations(page, { include, exclude } = {}) {
  await settleAnimations(page);
  let builder = new AxeBuilder({ page });
  if (include) builder = builder.include(include);
  if (exclude) builder = builder.exclude(exclude);
  const results = await builder.analyze();
  return results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact),
  );
}

// Phase 18 — resolves the two flagship listings' real (reseed-dependent)
// ids by their stable `slug`, via a direct `GET /search` call. Mirrors
// `inventoryAccessibility.spec.js`'s own `resolveListingId` helper, which
// solves this exact "the id changes on every `db:seed:demo` run" problem
// for the same `seeds/demo/seedDemoInventoryScenarios.js` fixtures.
const API_BASE = 'http://localhost:4000/api/v1/';
const PHASE_18_FLAGSHIP_SLUGS = {
  hotel: 'demo-vendor-boutique-yerevan-hotel',
  tour: 'demo-vendor-dilijan-trail-tour',
};

async function resolveListingId(slug) {
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const res = await ctx.get(`search?keyword=${encodeURIComponent(slug)}`);
  const body = await res.json();
  const match = (body.data ?? []).find((listing) => listing.slug === slug);
  await ctx.dispose();
  if (!match) {
    throw new Error(
      `Fixture listing "${slug}" not found via search — did the Phase 18 demo seed run? status=${res.status()} body=${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return match.id;
}

test('Home page has no serious/critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/en');
  const violations = await seriousOrCriticalViolations(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test('Search page has no serious/critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/en/search');
  const violations = await seriousOrCriticalViolations(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test('Listing detail page has no serious/critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/en/search');
  await page.locator('a[href*="/en/listings/"]').first().click();
  // Listing links prefer the real slug over the numeric id (SearchResultCard.jsx,
  // ListingDetailPageContent.jsx: `slug ?? id`) — assert on the route shape, not a
  // numeric-only id that a slugged listing will never have.
  await expect(page).toHaveURL(/\/en\/listings\/[^/]+/);
  const violations = await seriousOrCriticalViolations(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

test('Partner dashboard has no serious/critical accessibility violations', async ({
  page,
}) => {
  await page.goto('/en/auth/login');
  await page.getByLabel('Email').fill('partner.hotels@example.com');
  await page.getByLabel('Password').fill('DemoPass!2024');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/en\/partner$/);
  const violations = await seriousOrCriticalViolations(page);
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});

// 2026 SEO/performance audit: these six all need the same signed-in
// customer, and each performed its own fresh UI login — safe in
// isolation, but Playwright's default `fullyParallel` config runs them
// across several workers at once, and several concurrent logins for the
// SAME account raced each other's session/refresh-token state (real,
// reproduced evidence: a different subset failed each full-suite run,
// always "redirected to /auth/login", while a direct API login for the
// same credentials succeeded instantly every time).
//
// Two other fixes were tried and rejected before this one: a shared
// `storageState` file across workers just moves the race to the
// backend's refresh-token rotation (`authenticationService.js`'s "strict
// single-use rotation with reuse detection" — a second context
// refreshing an already-rotated token gets `AUTH_TOKEN_REUSE_DETECTED`
// and is forced back to login); a worker-scoped login fixture only
// reduces concurrent logins from "6 tests" to "N workers" — with more
// than one worker (the default), the race still exists, just less often.
// `.serial` is the fix the file's own pre-existing "Payments
// accessibility" block already uses for this identical problem: it
// forces every test here onto ONE worker, one at a time, so each fresh
// login genuinely never overlaps with another. Nothing about session
// rotation, refresh-token security, or rate limits is touched.
test.describe.serial('Customer account pages (same shared account)', () => {
  test('Notifications page has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.goto('/en/account/notifications');
    await expect(
      page.getByRole('heading', { name: 'Notifications' }),
    ).toBeVisible();
    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('Notification bell dropdown has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.getByRole('button', { name: /Notifications/ }).click();
    await expect(page.getByText('View all notifications')).toBeVisible();
    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('Messaging page (chat window) has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    // The Customer Account dashboard genuinely has two real links named
    // "Messages" — the sidebar nav item and a "quick links" card — both
    // going to the same route; `.first()` picks one deterministically
    // rather than leaving an ambiguous multi-match locator (a Playwright
    // strict-mode violation, not a real accessibility issue).
    await page.getByRole('link', { name: 'Messages' }).first().click();
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
    await page
      .getByRole('listitem')
      .filter({ has: page.locator('button') })
      .first()
      .click();
    await expect(page.getByPlaceholder('Write a message…')).toBeVisible({
      timeout: 10_000,
    });

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('Messaging bell dropdown has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.getByRole('button', { name: /Messages/ }).click();
    await expect(page.getByText('View all messages')).toBeVisible();
    // Scoped to `header` (trigger + popover) — the dropdown opens over the
    // Account Overview page's unrelated content; this test only cares
    // about the bell trigger and its popover panel.
    const violations = await seriousOrCriticalViolations(page, {
      include: 'header',
    });
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('AI Trip Planner page has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.goto('/en/account/trip-planner');
    await expect(
      page.getByRole('heading', { name: 'AI Trip Planner' }),
    ).toBeVisible();

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('AI Assistant drawer has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.getByRole('button', { name: 'Ask AI assistant' }).click();
    await expect(
      page.getByRole('heading', { name: 'AI Assistant' }),
    ).toBeVisible();

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});

// Serial + one retry: each test here logs in (sharing the tight
// `sensitiveRateLimiter` tier — `POST /auth/login` and the
// `/auth/refresh` call `AuthProvider` fires on every full page load —
// with every other spec file hitting the same IP), and reaches every
// sub-page via a client-side `<Link>` click rather than a second
// `page.goto()` wherever possible, to stay well under that ceiling.
// Mirrors `payments.spec.js`'s own header comment on the same fix.
test.describe.serial('Payments accessibility', () => {
  test.describe.configure({ retries: 1 });

  test('My payments page has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.getByRole('link', { name: 'Payments', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'My payments' }),
    ).toBeVisible();

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('A booking detail page with an active payment has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('anna.harutyunyan@example.com');
    await page.getByLabel('Password').fill('DemoPass!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/account$/);

    await page.getByRole('link', { name: 'Bookings', exact: true }).click();
    const firstBookingLink = page
      .locator('a[href*="/account/bookings/"]')
      .first();
    await expect(firstBookingLink).toBeVisible();
    await firstBookingLink.click();
    await expect(
      page.getByRole('heading', { level: 1, name: /^Booking BK-/ }),
    ).toBeVisible({ timeout: 10_000 });

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('Admin payments list and payment detail page have no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('admin@travelhub.dev');
    await page.getByLabel('Password').fill('DevAdmin!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/admin$/);

    await page.getByRole('link', { name: 'Payments', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
    const listViolations = await seriousOrCriticalViolations(page);
    expect(listViolations, JSON.stringify(listViolations, null, 2)).toEqual([]);

    const firstReferenceLink = page
      .locator('a[href*="/admin/payments/"]')
      .first();
    await expect(firstReferenceLink).toBeVisible({ timeout: 10_000 });
    await firstReferenceLink.click();
    await expect(
      page.getByRole('heading', { name: /^Payment PAY-/ }),
    ).toBeVisible({ timeout: 10_000 });

    const detailViolations = await seriousOrCriticalViolations(page);
    expect(detailViolations, JSON.stringify(detailViolations, null, 2)).toEqual(
      [],
    );
  });
});

// Phase 18 (Premium Listing Detail Experience) — three genuinely new
// surfaces this phase shipped that no scan above ever touches: the
// mobile booking drawer (Phase 18.11, brand new this session), the
// Partner Content editor's add/remove-row + Select + Switch UI (Phase
// 18.10), and the tour category's Itinerary timeline (Phase 18.7),
// which the generic "Listing detail page" scan above never reliably
// exercises since it just clicks whichever listing search ranks first.
test.describe('Phase 18 accessibility', () => {
  // 2026 SEO/performance audit: "Partner Content step" logs in as its own
  // dedicated account (`vendor@travelhub.dev`, used nowhere else in this
  // suite — no per-account race is possible), but was observed to fail
  // once with the same "stuck on /auth/login" symptom while several
  // OTHER tests in OTHER describe blocks were logging in as different
  // accounts at the same wall-clock moment across parallel workers —
  // `RATE_LIMIT_SENSITIVE_PER_MINUTE=10` is shared by IP, not by
  // account, so enough concurrent logins from unrelated tests can still
  // transiently exhaust it between `fixtures.js`'s per-test flushes. One
  // retry absorbs that, same mitigation the file's own pre-existing
  // "Payments accessibility" block already uses for this identical class
  // of flakiness — real rate limiter, unweakened.
  test.describe.configure({ retries: 1 });

  test('Mobile listing detail page with the booking drawer open has no serious/critical accessibility violations', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const hotelId = await resolveListingId(PHASE_18_FLAGSHIP_SLUGS.hotel);
    await page.goto(`/en/listings/${hotelId}`);

    // Two elements share the "Check availability" accessible name at this
    // viewport (the sidebar's hidden copy of the reservation widget and
    // the fixed mobile bar's own CTA) — `:visible` narrows to the real,
    // interactive one.
    const mobileCta = page
      .getByRole('button', { name: 'Check availability' })
      .and(page.locator(':visible'));
    await expect(mobileCta).toBeVisible({ timeout: 10_000 });
    await mobileCta.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unit' })).toBeVisible();
    // The drawer's shared Overlay backdrop fades in over
    // `$motion-transition` (300ms, Overlay.module.scss's own
    // `overlay-backdrop-in` keyframe) — scanning mid-fade briefly drops
    // every descendant's effective contrast (opacity blends text color
    // toward the backdrop), which axe legitimately flags even though it's
    // not a real static-state defect. Waiting past the transition avoids
    // that timing false positive.
    await page.waitForTimeout(350);

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('Partner Content step (seeded rows, an open icon Select, and Switch toggles) has no serious/critical accessibility violations', async ({
    page,
  }) => {
    const tourId = await resolveListingId(PHASE_18_FLAGSHIP_SLUGS.tour);
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('vendor@travelhub.dev');
    await page.getByLabel('Password').fill('DevVendor!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/partner$/);

    await page.goto(
      `/en/partner/listings/new?listingId=${tourId}&step=content`,
    );
    await expect(
      page.getByRole('heading', { name: 'Frequently asked questions' }),
    ).toBeVisible({ timeout: 10_000 });

    // Opens one row's icon Select (listbox + options) so the scan covers
    // its real open state, not just the closed trigger.
    await page.getByRole('button', { name: 'Icon' }).first().click();
    await expect(page.getByRole('listbox')).toBeVisible();

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('Tour listing detail page (desktop, Itinerary timeline) has no serious/critical accessibility violations', async ({
    page,
  }) => {
    const tourId = await resolveListingId(PHASE_18_FLAGSHIP_SLUGS.tour);
    await page.goto(`/en/listings/${tourId}`);
    await expect(page.getByRole('heading', { name: 'Itinerary' })).toBeVisible({
      timeout: 10_000,
    });
    // This flagship tour listing has no seeded reviews, so
    // ListingReviewsSection renders a real EmptyState ("No reviews
    // yet") — EmptyState.module.scss fades its whole container in via
    // `animation: empty-state-in` (opacity 0 -> 1). Waiting for the
    // Itinerary heading says nothing about whether THIS LATER section
    // has mounted yet, let alone finished fading in: a scan that lands
    // mid-fade blends the title's real, settled `$color-gray-900`
    // toward the white background, reading as a real (not spurious)
    // sub-4.5:1 ratio at that instant — same root cause the Mobile
    // booking-drawer test above already documents for the Overlay
    // backdrop's fade, and empirically confirmed here too (reproduced
    // in ~3/8 repeated runs before this fix, 0/8 after). Waiting past
    // the transition — not excluding the element or weakening the
    // assertion below — avoids the timing false positive.
    await page.waitForTimeout(350);

    const violations = await seriousOrCriticalViolations(page);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
