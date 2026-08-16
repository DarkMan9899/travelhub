/**
 * Phase 16 Payment Infrastructure: the customer "Pay Now" flow (success
 * and decline), the customer payment-history page, the partner payable-
 * balance card, and the admin payments list/detail/refund flow — against
 * the real backend + demo-seeded dev database
 * (`seedDemoMarketplace.js`'s 30 seeded payments/4 refunds give every
 * persona real payment states to assert against).
 *
 * `AuthProvider` attempts `POST /auth/refresh` on every full page load
 * (mount) — doubled by React StrictMode's dev-only double-invoke of
 * mount effects — and `/auth/login`/`/auth/refresh` share the
 * `sensitiveRateLimiter` tier's tight 10/min ceiling with every other
 * spec file hitting the same IP. A first version of this file used a
 * raw `page.goto()` per sub-page and tripped that ceiling mid-run — the
 * exact class of problem the Phase 15 lesson already named. The fix:
 * log in once per persona, then reach every other in-app page via a
 * client-side `<Link>` click (no full reload, no extra `/auth/refresh`
 * call) instead of a second `page.goto()`. Even so, four logins packed
 * into under 20 seconds (this file completes fast — no heavy rendering
 * to wait on) can still land on the exact edge of that 10/min ceiling;
 * `retries: 1` here is the test-execution-strategy fix the shared window
 * calls for, not a weakening of the limiter itself — by the time a retry
 * runs, the window has partially drained.
 */

import { test, expect } from './fixtures.js';

const API_BASE_URL = 'http://localhost:4000/api/v1';
const DEMO_PASSWORD = 'DemoPass!2024';

// Logs in as the given demo customer, capturing the access token from
// the UI login's own `POST /auth/login` network response, then uses
// that token to find a CONFIRMED booking (payable, per `PaymentService`'s
// `PAYABLE_BOOKING_STATUSES`) with no existing payment yet — i.e. one
// where the real UI shows `PayNowPanel`, not `PaymentSummaryCard`.
// Looked up directly via the API rather than guessing an id, since the
// demo seed only attaches payments to a deterministic subset of
// CONFIRMED/COMPLETED bookings — plenty of real unpaid ones remain.
async function loginAndFindUnpaidConfirmedBooking(page, request, email) {
  await page.goto('/en/auth/login');
  // The frontend dev server proxies `/api/v1/*` to the backend (see
  // `vite.config.js`), so the login request the browser actually makes
  // is same-origin (`http://localhost:5173/api/v1/auth/login`), not the
  // `API_BASE_URL` used below for the `request` fixture's own direct
  // backend calls.
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/auth/login') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
  );
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  const loginResponse = await loginResponsePromise;
  await expect(page).toHaveURL(/\/en\/account$/, { timeout: 10_000 });

  const { data: authData } = await loginResponse.json();
  const headers = { Authorization: `Bearer ${authData.access_token}` };

  const bookingsResponse = await request.get(
    `${API_BASE_URL}/bookings?status=CONFIRMED&limit=50`,
    { headers },
  );
  expect(bookingsResponse.ok()).toBe(true);
  const { data: bookings } = await bookingsResponse.json();

  // eslint-disable-next-line no-restricted-syntax -- sequential lookup over a small candidate list
  for (const booking of bookings) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const paymentsResponse = await request.get(
      `${API_BASE_URL}/payments?bookingId=${booking.id}`,
      { headers },
    );
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const { data: payments } = await paymentsResponse.json();
    if (payments.length === 0) {
      return booking;
    }
  }
  throw new Error(`No unpaid CONFIRMED booking found for ${email}.`);
}

// Client-side navigation to a specific booking's detail page — reuses
// the already-loaded app shell (no full reload, no extra
// `/auth/refresh` call), via the real "Bookings" nav link.
async function goToBookingDetailInApp(page, bookingId) {
  await page.getByRole('link', { name: 'Bookings', exact: true }).click();
  await page
    .locator(`a[href$="/account/bookings/${bookingId}"]`)
    .first()
    .click();
}

test.describe.serial('Payments', () => {
  test.describe.configure({ retries: 1 });

  test('a SUCCESS simulated payment shows the paid summary on the booking detail page and in payment history', async ({
    page,
    request,
  }) => {
    const booking = await loginAndFindUnpaidConfirmedBooking(
      page,
      request,
      'elena.simonyan@example.com',
    );

    await goToBookingDetailInApp(page, booking.id);
    await expect(
      page.getByRole('heading', { name: 'Pay for this booking' }),
    ).toBeVisible({ timeout: 10_000 });
    // "Development / Demo Payment" disclosure must be visible before any
    // simulated charge — Phase 16 spec §5/§20's required disclosure.
    await expect(
      page.getByText('Development / Demo Payment').first(),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Pay now' }).click();

    await expect(page.getByText('Payment successful.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Paid', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole('heading', { name: 'Pay for this booking' }),
    ).toHaveCount(0);

    // Same login, same session — the customer payment-history page shows
    // this same payment, reached via client-side nav (no extra login).
    await page.getByRole('link', { name: 'Payments', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'My payments' }),
    ).toBeVisible();
    await expect(page.getByText('View booking').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('a DECLINE simulated payment shows a Declined status and lets the customer retry', async ({
    page,
    request,
  }) => {
    const booking = await loginAndFindUnpaidConfirmedBooking(
      page,
      request,
      'tigran.vardanyan@example.com',
    );

    await goToBookingDetailInApp(page, booking.id);
    await expect(
      page.getByRole('heading', { name: 'Pay for this booking' }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('select-trigger').click();
    await page.getByRole('option', { name: 'Declined payment' }).click();
    await page.getByRole('button', { name: 'Pay now' }).click();

    await expect(
      page.getByText('The simulated payment was declined.'),
    ).toBeVisible({ timeout: 10_000 });
    // A terminal FAILED payment is retryable — `BookingPaymentSection`
    // shows `PayNowPanel` again rather than getting stuck.
    await expect(
      page.getByRole('heading', { name: 'Pay for this booking' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('the partner dashboard shows a real payable balance card', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('partner.hotels@example.com');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/partner$/, { timeout: 10_000 });

    await expect(
      page.getByRole('heading', { name: 'Payable balance' }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('an admin can inspect the payments list/detail and issue a simulated refund', async ({
    page,
  }) => {
    await page.goto('/en/auth/login');
    await page.getByLabel('Email').fill('admin@travelhub.dev');
    await page.getByLabel('Password').fill('DevAdmin!2024');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/en\/admin$/, { timeout: 10_000 });

    await page.getByRole('link', { name: 'Payments', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();

    // Scope to the SUCCEEDED filter (labeled "Paid" —
    // `payments.status.SUCCEEDED`) so the first row is guaranteed
    // refundable (`AdminPaymentDetailContent`'s own `REFUNDABLE_STATUSES`
    // is `['SUCCEEDED', 'PARTIALLY_REFUNDED']`).
    await page.getByTestId('select-trigger').click();
    await page.getByRole('option', { name: 'Paid', exact: true }).click();

    const firstReferenceLink = page
      .locator('a[href*="/admin/payments/"]')
      .first();
    await expect(firstReferenceLink).toBeVisible({ timeout: 10_000 });
    await firstReferenceLink.click();
    await expect(
      page.getByRole('heading', { name: /^Payment PAY-/ }),
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Issue refund' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Reason (optional)').fill('E2E refund check.');
    await dialog.getByRole('button', { name: 'Issue refund' }).click();

    await expect(page.getByText('Refund issued.')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText('Refunds')).toBeVisible({ timeout: 10_000 });
  });
});
