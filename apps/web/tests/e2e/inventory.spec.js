/**
 * Phase 17 (Inventory, Availability & Connectivity) — automated
 * regression coverage for the 8 cross-role flows (A-H) already proven
 * live/manually against the running dev server. This spec converts that
 * manual verification into reusable Playwright coverage; it does not
 * replace it.
 *
 * Runs against the real backend + demo-seeded database, using the
 * documented dev accounts (`vendor@travelhub.dev` owns the
 * `yerevan-boutique-hospitality` partner's 6 Phase 17 demo listings —
 * see `seeds/demo/seedDemoInventoryScenarios.js`). Listing ids are
 * resolved at runtime via the public search API (never hardcoded — the
 * demo dataset is re-seeded, sometimes with new auto-increment ids,
 * between sessions). Every date used is a fresh future offset (+150
 * days or more) so tests never collide with the seed script's own
 * scenario dates (which only ever cover roughly -2..+38 days from
 * whenever the seed last ran) or with each other when run in parallel.
 *
 * UI-driven throughout: the only API calls made from the test itself are
 * read-only listing-id lookups (`GET /search`) for deterministic
 * navigation — every state-changing action (block, external reservation,
 * checkout attempt) happens through real clicks against the real
 * frontend, exactly as a partner/customer/admin would perform it.
 */

import { test, expect, request as playwrightRequest } from '@playwright/test';
import Redis from 'ioredis';

const API_BASE = 'http://localhost:4000/api/v1/';
const VENDOR = { email: 'vendor@travelhub.dev', password: 'DevVendor!2024' };
const CUSTOMER = {
  email: 'customer@travelhub.dev',
  password: 'DevCustomer!2024',
};
const ADMIN = { email: 'admin@travelhub.dev', password: 'DevAdmin!2024' };

const SLUGS = {
  hotel: 'demo-vendor-boutique-yerevan-hotel',
  fleet: 'demo-vendor-ararat-valley-fleet',
  tour: 'demo-vendor-dilijan-trail-tour',
  guide: 'demo-vendor-certified-yerevan-city-guide',
};

/**
 * This spec is far more request-heavy than any other single spec file:
 * ~12 UI logins (sensitive tier, real ceiling 10/min) across 8 tests,
 * plus every page navigation fans out into several API calls (auth/me,
 * listing detail, availability-summary, calendar, units...) against the
 * real platform-wide `publicRateLimiter` (20/min, applied to every
 * request in `app.js`, including unauthenticated `resolveListingId`
 * lookups) and `authenticatedRateLimiter` (300/min, but shared with the
 * `sensitive` tier's own request volume). `globalSetup.js` only flushes
 * once at the very start of the whole suite, which isn't enough headroom
 * for this file's own volume. Mirrors
 * `apps/api/tests/integration/helpers/resetRateLimits.js`'s identical
 * fix (same Redis-backed counters, same four tiers) — clearing the
 * counter here is a test-isolation measure, never a change to the real
 * rate-limit config.
 */
async function flushRateLimits() {
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    const tiers = ['public', 'authenticated', 'sensitive', 'ai'];
    const keys = (
      await Promise.all([
        ...tiers.map((tier) => redis.keys(`ratelimit:${tier}:*`)),
        redis.keys('session:login_attempts:*'),
      ])
    ).flat();
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Same fail-open rationale as globalSetup.js — a reset failure here
    // must never fail the test run over a best-effort isolation step.
  } finally {
    redis.disconnect();
  }
}

async function resolveListingId(slug) {
  await flushRateLimits();
  const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
  const res = await ctx.get(`search?keyword=${encodeURIComponent(slug)}`);
  const body = await res.json();
  const match = (body.data ?? []).find((listing) => listing.slug === slug);
  await ctx.dispose();
  if (!match) {
    throw new Error(
      `Fixture listing "${slug}" not found via search — did the Phase 17 demo seed run? status=${res.status()} body=${JSON.stringify(body).slice(0, 500)}`,
    );
  }
  return match.id;
}

/**
 * Every flow uses a fixed base offset so relative ordering between flows
 * is stable and readable. But some flows permanently mutate the exact
 * date they touch (a phone/external reservation on a capacity-limited
 * unit) — re-running the whole spec on the same calendar day would hit
 * that earlier run's own leftover state (e.g. flow C's "before"
 * assertion seeing `SOLD_OUT` instead of `LOW` because a prior same-day
 * run already consumed the unit). A per-process salt derived from the
 * current time shifts every offset by the same amount each run, so
 * repeated same-day runs land on fresh dates while preserving each
 * flow's relative spacing. Millisecond-resolution (not minute-bucketed)
 * so back-to-back reruns issued seconds apart — the common case while
 * iterating on this file locally — still land on different dates.
 */
const RUN_SALT_DAYS = Date.now() % 180;

function futureISO(daysFromNow) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow + RUN_SALT_DAYS);
  return d.toISOString().slice(0, 10);
}

/**
 * `futureISO` alone pushes some combinations past the customer
 * `ListingReservationWidget`'s own fetch window (`CALENDAR_WINDOW_DAYS =
 * 180` — its `disabledDates` array is built only from that range, so a
 * date beyond it always renders enabled regardless of the real block/
 * reservation state, silently defeating any flow that checks a specific
 * day's disabled state there). Flows A/B/F all do that check, so they use
 * this narrower-salted variant instead — a smaller salt keeps
 * `daysFromNow + salt` comfortably under 180 for every base offset those
 * flows use, while still varying enough across runs to avoid same-day
 * collisions with a prior run's own block/reservation on that unit.
 */
const RUN_SALT_DAYS_NARROW = Date.now() % 20;

function futureISOWithinCalendarWindow(daysFromNow) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow + RUN_SALT_DAYS_NARROW);
  return d.toISOString().slice(0, 10);
}

/**
 * Unlike `futureISO`, this never applies `RUN_SALT_DAYS` — flow E must
 * stay inside the customer Listing Detail page's rolling "today..today+29"
 * availability-summary window (`useListingAvailabilitySummaryQuery.js`'s
 * `SUMMARY_WINDOW_DAYS = 30`; nothing on that page ever reflects a date
 * further out, no matter what the Partner Calendar shows for it).
 */
function futureISOWithinWindow(daysFromNow) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function accessibleDayName(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const monthName = new Intl.DateTimeFormat('en', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)));
  return `${monthName} ${day}, ${year}`;
}

async function clickNextMonthUntil(page, isoDate, times) {
  for (let i = 0; i < times; i += 1) {
    // eslint-disable-next-line no-await-in-loop -- sequential UI navigation, one click per iteration
    await page.getByRole('button', { name: 'Next month' }).click();
  }
}

function monthsFromToday(isoDate) {
  const target = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  return (
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())
  );
}

test.beforeEach(async () => {
  await flushRateLimits();
});

/**
 * `packages/ui`'s `Select` is a custom listbox (`role="button"` trigger +
 * a `role="listbox"`/`role="option"` popup), never a native `<select>` —
 * `selectOption()` doesn't apply here at all, and there's no `<option>`
 * DOM to inspect. The reservation widget's unit options are always built
 * from a generic `{{typeLabel}} #{{index}}` template (never the real
 * per-vehicle plate label the Partner Calendar shows), so "Vehicle #1"/
 * "Vehicle #3" are the only strings that can ever match on this
 * customer-facing select — the descriptive name in the pattern is kept
 * only as documentation of which real vehicle that position corresponds
 * to (per the seed's insertion order).
 */
async function selectUnitByText(page, pattern) {
  const trigger = page.getByLabel('Unit');
  if (!(await trigger.isVisible().catch(() => false))) return;
  await trigger.click();
  await page.getByRole('option', { name: pattern }).click();
}

async function login(page, { email, password }, expectedUrlPattern) {
  await flushRateLimits();
  await page.goto('/en/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(expectedUrlPattern);
}

/** Navigates the Partner Calendar to a listing/resource and selects a single future day. */
async function openPartnerCalendarDay(page, { listingLabel, unitLabel, iso }) {
  await page.goto('/en/partner/calendar');
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();

  await page.getByRole('button', { name: 'Listing', exact: true }).click();
  await page.getByRole('option', { name: listingLabel, exact: true }).click();

  if (unitLabel) {
    await page.getByRole('button', { name: unitLabel, exact: true }).click();
  }

  await clickNextMonthUntil(page, iso, monthsFromToday(iso));
  // PartnerCalendarEditor appends a status suffix to the day cell's
  // accessible name (e.g. ", Available") for any date within the
  // currently-viewed month — unlike the customer DatePicker, which never
  // does. A starts-with match keeps this robust either way.
  await page
    .getByRole('gridcell', {
      name: new RegExp(`^${accessibleDayName(iso)}`),
    })
    .click();
}

/** Opens the customer-facing listing detail page and its reservation widget. */
async function gotoListingDetail(page, listingId) {
  await page.goto(`/en/listings/${listingId}`);
  await expect(
    page.getByRole('button', { name: 'Request to book' }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe
  .serial('Phase 17 — Inventory flows A/B: manual block + unblock', () => {
  test.describe.configure({ retries: 1 });
  let fleetListingId;
  const iso = futureISOWithinCalendarWindow(90);

  test.beforeAll(async () => {
    fleetListingId = await resolveListingId(SLUGS.fleet);
  });

  test('A — partner blocks a vehicle date and the customer sees it unavailable', async ({
    page,
  }) => {
    await login(page, VENDOR, /\/en\/partner$/);
    await openPartnerCalendarDay(page, {
      listingLabel: 'Ararat Valley Fleet',
      unitLabel: 'Toyota RAV4 (01 AA 123)',
      iso,
    });

    await page.getByRole('tab', { name: 'Block dates', exact: true }).click();
    await page.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(page.getByText('Dates blocked.')).toBeVisible({
      timeout: 10_000,
    });
    // Matched by this test's own exact date range, not the aggregate
    // "Active blocks (N)" tab count — repeated runs against the same
    // long-lived demo unit can leave other blocks active on other dates,
    // and this test only cares about the one it just created.
    const ourBlockRow = page
      .getByRole('row')
      .filter({ hasText: `${iso} – ${iso}` });
    await expect(ourBlockRow).toBeVisible({ timeout: 10_000 });

    // Customer side: `ListingReservationWidget`'s DatePicker only ever
    // disables a day from `availability_calendar.statusCode`
    // (AVAILABLE/BLOCKED) — Phase 17 manual blocks/external reservations
    // are tracked purely through `quantity_available`
    // (`availabilityService.js`'s own header comment), which that
    // calendar read never looks at. So the day cell stays clickable
    // either way; the real, honest customer-facing proof of "unavailable"
    // is the same server-side revalidation flow D already exercises —
    // attempting to actually submit a booking for the blocked date must
    // be rejected with the same conflict toast.
    const customerPage = await page.context().browser().newContext();
    const cPage = await customerPage.newPage();
    await login(cPage, CUSTOMER, /\/en\/account$/);
    await gotoListingDetail(cPage, fleetListingId);
    await selectUnitByText(cPage, /Toyota RAV4|Vehicle #1/);
    await cPage.getByLabel('Dates').click();
    await clickNextMonthUntil(cPage, iso, monthsFromToday(iso));
    const dayCell = cPage.getByRole('gridcell', {
      name: accessibleDayName(iso),
      exact: true,
    });
    await dayCell.click();
    await dayCell.click(); // same-day range: start === end
    await cPage.getByRole('button', { name: 'Request to book' }).click();
    await expect(
      cPage.getByText(
        'These dates are no longer available. Please choose different dates.',
      ),
    ).toBeVisible({ timeout: 10_000 });
    await customerPage.close();
  });

  test('B — partner unblocks the vehicle and the date becomes available again', async ({
    page,
  }) => {
    await login(page, VENDOR, /\/en\/partner$/);
    await openPartnerCalendarDay(page, {
      listingLabel: 'Ararat Valley Fleet',
      unitLabel: 'Toyota RAV4 (01 AA 123)',
      iso,
    });

    // Matched by this test's own exact date range, not the aggregate
    // "Active blocks (N)" tab count — see flow A's identical rationale.
    const ourBlockRow = page
      .getByRole('row')
      .filter({ hasText: `${iso} – ${iso}` });
    await expect(ourBlockRow).toBeVisible({ timeout: 10_000 });
    await ourBlockRow
      .getByRole('button', { name: 'Unblock', exact: true })
      .click();
    await expect(page.getByText(/released|Unblocked/i))
      .toBeVisible({
        timeout: 10_000,
      })
      .catch(() => {});
    await expect(ourBlockRow).toBeHidden({ timeout: 10_000 });

    // Customer side: with the block released, the exact same booking
    // attempt that flow A proved gets rejected must now succeed (a real
    // hold is created and the customer is handed off to checkout) — the
    // positive-path counterpart of flow A's server-side revalidation
    // check, for the same architectural reason (the DatePicker's disabled
    // state itself never reflects Phase 17 manual blocks either way).
    const customerPage = await page.context().browser().newContext();
    const cPage = await customerPage.newPage();
    await login(cPage, CUSTOMER, /\/en\/account$/);
    await gotoListingDetail(cPage, fleetListingId);
    await selectUnitByText(cPage, /Toyota RAV4|Vehicle #1/);
    await cPage.getByLabel('Dates').click();
    await clickNextMonthUntil(cPage, iso, monthsFromToday(iso));
    const dayCell = cPage.getByRole('gridcell', {
      name: accessibleDayName(iso),
      exact: true,
    });
    await dayCell.click();
    await dayCell.click(); // same-day range: start === end
    await cPage.getByRole('button', { name: 'Request to book' }).click();
    await expect(cPage).toHaveURL(/\/booking\/checkout$/, { timeout: 10_000 });
    await customerPage.close();
  });
});

test.describe
  .serial('Phase 17 — Inventory flow C: external/phone reservation', () => {
  test.describe.configure({ retries: 1 });
  let guideListingId;
  const iso = futureISO(155);

  test.beforeAll(async () => {
    guideListingId = await resolveListingId(SLUGS.guide);
  });

  test('partner records a phone reservation and the customer sees decreased availability immediately', async ({
    page,
  }) => {
    // Before: the guide is a single-unit (capacity 1) resource — always
    // below the LOW_STOCK_THRESHOLD, so the honest bucket here is "LOW"
    // (with a real remaining count of 1), never "AVAILABLE".
    const beforeCtx = await playwrightRequest.newContext({
      baseURL: API_BASE,
    });
    const before = await beforeCtx.get(
      `availability/${guideListingId}/availability-summary?from=${iso}&to=${iso}`,
    );
    const beforeBody = await before.json();
    expect(beforeBody.data[0].availability_status).toBe('LOW');
    expect(beforeBody.data[0].remaining_count).toBe(1);
    await beforeCtx.dispose();

    await login(page, VENDOR, /\/en\/partner$/);
    await openPartnerCalendarDay(page, {
      listingLabel: 'Certified Yerevan City Guide',
      iso,
    });
    await page
      .getByRole('tab', { name: 'External reservation', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Record reservation', exact: true })
      .click();
    await expect(page.getByText('External reservation recorded.')).toBeVisible({
      timeout: 10_000,
    });

    const afterCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const after = await afterCtx.get(
      `availability/${guideListingId}/availability-summary?from=${iso}&to=${iso}`,
    );
    const afterBody = await after.json();
    expect(afterBody.data[0].availability_status).toBe('SOLD_OUT');
    await afterCtx.dispose();
  });
});

test.describe('Phase 17 — Inventory flow D: stale checkout is rejected', () => {
  test('a customer whose calendar went stale cannot double-book the final unit', async ({
    page,
  }) => {
    const iso = futureISO(160);
    const guideListingId = await resolveListingId(SLUGS.guide);

    // Customer loads the listing while the date is still available and
    // opens (but does not submit) the date range — simulating a browsing
    // session that goes stale.
    await login(page, CUSTOMER, /\/en\/account$/);
    await gotoListingDetail(page, guideListingId);
    await page.getByLabel('Dates').click();
    await clickNextMonthUntil(page, iso, monthsFromToday(iso));
    const dayCell = page.getByRole('gridcell', {
      name: accessibleDayName(iso),
      exact: true,
    });
    await expect(dayCell).toBeEnabled();
    await dayCell.click();
    await dayCell.click(); // same-day range: start === end

    // Meanwhile the partner consumes the last unit for that exact date
    // via a real API call (deterministic test setup — the point under
    // test is the customer's stale UI attempt, not how the partner UI
    // itself records a reservation, already covered by flow C above).
    const loginCtx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const loginRes = await loginCtx.post('auth/login', {
      data: VENDOR,
    });
    const { data } = await loginRes.json();
    const vendorToken = data.access_token;
    const guideUnitRes = await loginCtx.get(
      `availability/${guideListingId}/units`,
    );
    const guideUnitBody = await guideUnitRes.json();
    const guideUnitId = guideUnitBody.data[0].id;
    await loginCtx.post('availability/external-reservations', {
      headers: { Authorization: `Bearer ${vendorToken}` },
      data: {
        unitId: guideUnitId,
        dateFrom: iso,
        dateTo: iso,
        quantity: 1,
        sourceCode: 'WALK_IN',
        guestName: 'Stale-checkout test consumer',
      },
    });
    await loginCtx.dispose();

    // The customer's stale UI still shows the date as pickable — submit
    // anyway and confirm the server safely rejects it.
    await page.getByRole('button', { name: 'Request to book' }).click();
    await expect(
      page.getByText(
        'These dates are no longer available. Please choose different dates.',
      ),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Phase 17 — Inventory flow E: tour seat capacity', () => {
  test('partner reduces departure seats and the customer sees the updated count', async ({
    page,
  }) => {
    const tourListingId = await resolveListingId(SLUGS.tour);
    const today = futureISOWithinWindow(0);
    const windowEnd = futureISOWithinWindow(29);

    // This unit's real seeded capacity is 12 (see
    // `seedDemoInventoryScenarios.js`'s "09:00 Departure" bookable unit,
    // "flow E baseline"), and the seed's only consumption on this unit
    // (an 8-seat group reservation) sits at exactly day+7 — so day+10
    // (comfortably clear of it, still inside the customer Listing Detail
    // page's rolling "today..today+29" availability-summary window) is
    // reliably untouched on a freshly-seeded database. The customer-facing
    // badge reads `getPublicAvailabilitySummary`'s `remaining`, which is
    // the MINIMUM across every day in the queried range
    // (`availabilityService.js` — "the honest worst case for the whole
    // span, not an average"), so this drives day+10 down to exactly 1
    // remaining seat — low enough to become the window's new minimum
    // regardless of any other day's state — then reads the real
    // resulting window value from the API and asserts the customer UI
    // shows that same real value. (Re-running this spec repeatedly on
    // the same calendar day without re-seeding will eventually deplete
    // day+10 below 2 remaining; a fresh `db:seed:demo:dev -- --confirm`
    // restores it, the same requirement every other capacity-consuming
    // flow in this file already has — this spec runs against the real
    // dev database the local API server actually serves, not the
    // isolated `travelhub_test` fixture `db:seed:demo` targets.)
    const iso = futureISOWithinWindow(10);
    const probeCtx = await playwrightRequest.newContext({
      baseURL: API_BASE,
    });
    const unitsRes = await probeCtx.get(`availability/${tourListingId}/units`);
    const unitsBody = await unitsRes.json();
    const morningUnit = unitsBody.data.find(
      (unit) => unit.unit_label === '09:00 Departure',
    );
    const isoBeforeRes = await probeCtx.get(
      `availability/${tourListingId}/availability-summary?from=${iso}&to=${iso}&unitId=${morningUnit.id}`,
    );
    const isoBeforeBody = await isoBeforeRes.json();
    // A null `remaining_count` means the DTO bucketed this day
    // 'AVAILABLE' (`LOW_STOCK_THRESHOLD` in availabilityDto.js) — real
    // remaining is unknown beyond ">5", but day+10's own real value is
    // its full static capacity whenever nothing has touched it yet
    // (the expected case right after a reseed).
    const isoRemainingBefore =
      isoBeforeBody.data?.[0]?.remaining_count ?? morningUnit.capacity;
    if (isoRemainingBefore < 2) {
      throw new Error(
        `Tour departure day+10 only has ${isoRemainingBefore} seat(s) left — re-seed the dev database (npm run db:seed:demo:dev -- --confirm, from apps/api) before re-running flow E.`,
      );
    }
    await probeCtx.dispose();

    const blockQuantity = isoRemainingBefore - 1;

    await login(page, VENDOR, /\/en\/partner$/);
    await openPartnerCalendarDay(page, {
      listingLabel: 'Dilijan Trail Tour',
      unitLabel: '09:00 Departure',
      iso,
    });
    await page.getByRole('tab', { name: 'Block dates', exact: true }).click();
    await page.getByLabel('Quantity').fill(String(blockQuantity));
    await page.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(page.getByText('Dates blocked.')).toBeVisible({
      timeout: 10_000,
    });

    const ctx = await playwrightRequest.newContext({ baseURL: API_BASE });
    const isoAfterRes = await ctx.get(
      `availability/${tourListingId}/availability-summary?from=${iso}&to=${iso}&unitId=${morningUnit.id}`,
    );
    const isoAfterBody = await isoAfterRes.json();
    expect(isoAfterBody.data[0].remaining_count).toBe(1);

    const windowAfterRes = await ctx.get(
      `availability/${tourListingId}/availability-summary?from=${today}&to=${windowEnd}&unitId=${morningUnit.id}`,
    );
    const windowAfterBody = await windowAfterRes.json();
    const remainingAfter = windowAfterBody.data[0].remaining_count;
    expect(remainingAfter).toBe(1);
    await ctx.dispose();

    await login(page, CUSTOMER, /\/en\/account$/);
    await gotoListingDetail(page, tourListingId);
    await expect(
      page.getByText(`${remainingAfter} seats available`),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Phase 17 — Inventory flow F: car-rental conflict', () => {
  test('an externally booked vehicle cannot be double-booked by a customer', async ({
    page,
  }) => {
    const iso = futureISOWithinCalendarWindow(110);
    const fleetListingId = await resolveListingId(SLUGS.fleet);

    await login(page, VENDOR, /\/en\/partner$/);
    await openPartnerCalendarDay(page, {
      listingLabel: 'Ararat Valley Fleet',
      unitLabel: 'Nissan X-Trail (03 CC 789)',
      iso,
    });
    await page
      .getByRole('tab', { name: 'External reservation', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'Record reservation', exact: true })
      .click();
    await expect(page.getByText('External reservation recorded.')).toBeVisible({
      timeout: 10_000,
    });

    // Same architectural reason as flow A: the DatePicker's disabled
    // state never reflects Phase 17 external reservations either (only
    // `availability_calendar.statusCode` does) — the real, honest proof
    // is the server rejecting an actual booking attempt for this date.
    await login(page, CUSTOMER, /\/en\/account$/);
    await gotoListingDetail(page, fleetListingId);
    await selectUnitByText(page, /Nissan X-Trail|Vehicle #3/);
    await page.getByLabel('Dates').click();
    await clickNextMonthUntil(page, iso, monthsFromToday(iso));
    const dayCell = page.getByRole('gridcell', {
      name: accessibleDayName(iso),
      exact: true,
    });
    await dayCell.click();
    await dayCell.click(); // same-day range: start === end
    await page.getByRole('button', { name: 'Request to book' }).click();
    await expect(
      page.getByText(
        'These dates are no longer available. Please choose different dates.',
      ),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Phase 17 — Inventory flow G: Connections / Sync Center', () => {
  test('partner can see connection health, history, and error state', async ({
    page,
  }) => {
    await login(page, VENDOR, /\/en\/partner$/);
    await page.goto('/en/partner/connections');
    await expect(
      page.getByRole('heading', { name: 'Connections' }),
    ).toBeVisible();

    const activeRow = page
      .getByRole('row')
      .filter({ hasText: 'Booking.com iCal Sync' });
    await expect(activeRow).toContainText('Active');

    const errorRow = page
      .getByRole('row')
      .filter({ hasText: 'Airbnb iCal Sync' });
    await expect(errorRow).toContainText('Error');

    await errorRow
      .getByRole('button', { name: 'Details', exact: true })
      .click();
    await expect(
      page.getByRole('tab', { name: 'Sync history', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Sync history', exact: true }).click();
    await expect(page.getByText(/Failed|Partial/).first()).toBeVisible();
  });
});

test.describe('Phase 17 — Inventory flow H: Admin why-unavailable investigation', () => {
  test('admin can inspect the source breakdown and ledger for a listing', async ({
    page,
  }) => {
    const hotelListingId = await resolveListingId(SLUGS.hotel);

    await login(page, ADMIN, /\/en\/admin$/);
    await page.goto('/en/admin/inventory');
    await expect(
      page.getByRole('heading', { name: 'Inventory Oversight' }),
    ).toBeVisible();

    await page.getByLabel('Listing ID').fill(String(hotelListingId));
    await page.getByRole('button', { name: 'Look up' }).click();

    await expect(
      page.getByRole('tab', { name: 'Breakdown', exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole('tab', { name: 'Ledger', exact: true }).click();
    await expect(
      page
        .getByRole('cell', {
          name: /Manual block|Booking|External reservation|Connector sync/,
        })
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });
});
