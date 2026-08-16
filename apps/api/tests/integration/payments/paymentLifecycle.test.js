/**
 * Phase 16 (Payment Infrastructure): exercises the full simulated payment
 * lifecycle end to end against `LocalPaymentProvider` — creation
 * (success/decline/processing-then-webhook-settlement), idempotency, the
 * one-active-payment-per-booking guard, visibility (customer/partner/
 * admin scoping), and refunds (full/partial/excess-rejection/permission).
 *
 * Uses one dedicated, throwaway customer account plus one "stranger"
 * identity, both registered ONCE in `beforeAll` (never the shared
 * `DEV_CREDENTIALS.customer`, which accumulates state from other
 * integration files in a full-suite run — the exact class of bug fixed
 * in `recommendations.test.js` earlier this phase) — registering more
 * than a couple of accounts here would trip auth's own legitimate
 * `sensitiveRateLimiter` (10/min on `register`/`login`). A fresh
 * *booking* is created per test case (via `createBookingFixture`), which
 * is what actually needs per-test isolation for this file's assertions.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';
import { DEV_CREDENTIALS } from '../../../src/infrastructure/database/seeds/005_dev_accounts.js';

let vendor;
let admin;
let partnerId;
let languageId;
// A single, reused dedicated customer fixture (plus one "stranger" identity
// for the authorization-negative cases) — see header comment. `login`/
// `register` both sit behind auth's own `sensitiveRateLimiter` (10/min),
// so this file deliberately registers as few distinct accounts as
// possible; every test still gets a fresh *booking*, which is what
// actually needs per-test isolation.
let customer;
let stranger;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
}

async function registerCustomer(label) {
  const email = `payments-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'PaymentsFixture!2024',
    firstName: 'Payments',
    lastName: label,
  });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function createListing(title) {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType: 'HOTEL',
      translations: [{ languageId, title }],
    });
  const listingId = res.body.data.id;

  await request(app)
    .patch(`/api/v1/listings/${listingId}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ location: { latitude: 40.1772, longitude: 44.5035 } });
  await request(app)
    .post(`/api/v1/listings/${listingId}/media`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .set('Content-Type', 'image/png')
    .send(ONE_PX_PNG);
  await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType: 'HOTEL_ROOM' });
  await request(app)
    .post(`/api/v1/listings/${listingId}/publish`)
    .set('Authorization', `Bearer ${vendor.accessToken}`);

  return listingId;
}

async function registerUnit(listingId) {
  const res = await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType: 'HOTEL_ROOM', capacity: 1 });
  return res.body.data.id;
}

async function setPrice(unitId, dateFrom, dateTo, amount) {
  await request(app)
    .post('/api/v1/availability')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      unitId,
      dateFrom,
      dateTo,
      status: 'AVAILABLE',
      priceOverrideAmount: amount,
      priceOverrideCurrency: 'AMD',
    });
}

async function createHold(customerAuth, unitId, dateFrom, dateTo) {
  const res = await request(app)
    .post('/api/v1/booking-holds')
    .set('Authorization', `Bearer ${customerAuth.accessToken}`)
    .send({
      items: [{ bookableUnitId: unitId, dateFrom, dateTo, quantity: 1 }],
    });
  return res.body.data.items[0].hold_ids;
}

const GUEST_CONTACT = {
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+37400000000',
};

/**
 * Creates one fresh, priced, holdable booking for the given customer and
 * returns its id — `totalAmount` ends up exactly equal to `desiredTotal`.
 * The unit is `HOTEL_ROOM` (accommodation), so 2027-05-01 check-in /
 * 2027-05-02 check-out is checkout-exclusive — exactly 1 occupied night
 * (see `accommodationDateSemantics.js`) — priced at `desiredTotal` for
 * that single night, not split across both calendar dates.
 */
async function createBookingFixture(customerAuth, desiredTotal = 10_000) {
  const listingId = await createListing(
    `Payments Fixture ${Date.now()}-${Math.random()}`,
  );
  const unitId = await registerUnit(listingId);
  const dateFrom = '2027-05-01';
  const dateTo = '2027-05-02';
  await setPrice(unitId, dateFrom, dateTo, desiredTotal);
  const holdIds = await createHold(customerAuth, unitId, dateFrom, dateTo);
  const res = await request(app)
    .post('/api/v1/bookings')
    .set('Authorization', `Bearer ${customerAuth.accessToken}`)
    .send({
      items: [{ holdIds, guests: [] }],
      guestContactSnapshot: GUEST_CONTACT,
    });
  expect(res.status).toBe(201);
  expect(res.body.data.total_amount).toBe(`${desiredTotal.toFixed(2)}`);
  return res.body.data;
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();

  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );
  customer = await registerCustomer('customer');
  stranger = await registerCustomer('stranger');

  const pool = getMysqlPool();
  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('POST /payments — creates a Payment for a booking', () => {
  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ bookingId: 1 });
    expect(res.status).toBe(401);
  });

  test('SUCCESS scenario: resolves synchronously to SUCCEEDED, updates the booking payment status, is clearly labeled simulated', async () => {
    const booking = await createBookingFixture(customer, 12_000);

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('SUCCEEDED');
    expect(res.body.data.total_amount).toBe('12000.00');
    expect(res.body.data.captured_amount).toBe('12000.00');
    expect(res.body.data.refundable_amount).toBe('12000.00');
    expect(res.body.data.is_simulated).toBe(true);
    expect(res.body.data.provider).toBe('local');
    expect(res.body.data.payment_reference).toMatch(/^PAY-\d{8}-[A-Z2-9]{8}$/);
    expect(
      res.body.data.transactions.some((t) => t.type === 'PAYMENT_CREATED'),
    ).toBe(true);
    expect(
      res.body.data.transactions.some((t) => t.type === 'PAYMENT_CAPTURED'),
    ).toBe(true);

    const bookingRes = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(bookingRes.body.data.payment_status).toBe('PAID_ONLINE');
  });

  test('DECLINE scenario: resolves to FAILED, booking payment status becomes PAYMENT_FAILED, booking status_id is untouched', async () => {
    const booking = await createBookingFixture(customer);

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'DECLINE' });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('FAILED');
    expect(res.body.data.failure_code).toBe('card_declined');
    expect(res.body.data.captured_amount).toBe('0.00');

    const bookingRes = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(bookingRes.body.data.payment_status).toBe('PAYMENT_FAILED');
    // Online payment integration never touches the vendor-confirmation
    // workflow (Phase 16's deliberate, minimal integration boundary).
    expect(bookingRes.body.data.status).toBe('PENDING_VENDOR');
  });

  test('a repeated request with the same idempotencyKey returns the original payment, never a duplicate', async () => {
    const booking = await createBookingFixture(customer);
    const idempotencyKey = `idem-test-${Date.now()}`;

    const first = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        bookingId: booking.id,
        idempotencyKey,
        simulateScenario: 'SUCCESS',
      });
    const second = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        bookingId: booking.id,
        idempotencyKey,
        simulateScenario: 'SUCCESS',
      });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const listRes = await request(app)
      .get(`/api/v1/payments?bookingId=${booking.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.body.data).toHaveLength(1);
  });

  test('a second payment cannot be created while one is still PROCESSING for the same booking (409 PAYMENT_ALREADY_ACTIVE)', async () => {
    const booking = await createBookingFixture(customer);

    const first = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'PROCESSING' });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe('PROCESSING');

    const second = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('PAYMENT_ALREADY_ACTIVE');
  });

  test("a customer cannot pay for someone else's booking — 404-masked, since bookingService.getBooking itself hides a booking the caller can't see", async () => {
    const booking = await createBookingFixture(customer);

    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });
    expect(res.status).toBe(404);
  });
});

describe('Payment webhook settlement (PROCESSING -> SUCCEEDED)', () => {
  test('a synthetic local provider webhook resolves a PROCESSING payment to SUCCEEDED, and redelivery is a safe no-op', async () => {
    const booking = await createBookingFixture(customer, 8_000);

    const created = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'PROCESSING' });
    expect(created.body.data.status).toBe('PROCESSING');
    const providerPaymentId = created.body.data.provider_payment_id;
    expect(providerPaymentId).toMatch(/^local_pi_/);

    const eventId = `evt_test_${Date.now()}`;
    const webhookPayload = {
      id: eventId,
      type: 'local.payment.succeeded',
      providerPaymentId,
      status: 'SUCCEEDED',
    };

    const firstDelivery = await request(app)
      .post('/api/v1/payments/webhooks/local')
      .send(webhookPayload);
    expect(firstDelivery.status).toBe(200);

    const afterFirst = await request(app)
      .get(`/api/v1/payments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(afterFirst.body.data.status).toBe('SUCCEEDED');
    expect(afterFirst.body.data.captured_amount).toBe('8000.00');
    const capturedTransactionCount = afterFirst.body.data.transactions.filter(
      (t) => t.type === 'PAYMENT_CAPTURED',
    ).length;
    expect(capturedTransactionCount).toBe(1);

    // Redelivering the exact same provider event must never double-apply
    // the outcome (Phase 16 spec §13/§9).
    const secondDelivery = await request(app)
      .post('/api/v1/payments/webhooks/local')
      .send(webhookPayload);
    expect(secondDelivery.status).toBe(200);

    const afterSecond = await request(app)
      .get(`/api/v1/payments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(afterSecond.body.data.status).toBe('SUCCEEDED');
    expect(afterSecond.body.data.captured_amount).toBe('8000.00');
    expect(
      afterSecond.body.data.transactions.filter(
        (t) => t.type === 'PAYMENT_CAPTURED',
      ).length,
    ).toBe(1);
  });
});

describe('Payment visibility scoping', () => {
  test("a payment is 404-masked to anyone other than its customer, the booking's partner, or payment.view", async () => {
    const booking = await createBookingFixture(customer);
    const created = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const strangerRes = await request(app)
      .get(`/api/v1/payments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(strangerRes.status).toBe(404);

    const vendorRes = await request(app)
      .get(`/api/v1/payments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(vendorRes.status).toBe(200);

    const adminRes = await request(app)
      .get(`/api/v1/payments/${created.body.data.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(adminRes.status).toBe(200);
  });

  test('listPayments: customer sees only their own, partner sees only their own partnerId, admin viewAll sees everything', async () => {
    const booking = await createBookingFixture(customer);
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const ownRes = await request(app)
      .get('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(ownRes.status).toBe(200);
    expect(ownRes.body.data.length).toBeGreaterThan(0);

    const partnerRes = await request(app)
      .get(`/api/v1/payments?partnerId=${partnerId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(partnerRes.status).toBe(200);
    expect(partnerRes.body.data.some((p) => p.booking_id === booking.id)).toBe(
      true,
    );

    const forbiddenPartnerRes = await request(app)
      .get(`/api/v1/payments?partnerId=${partnerId}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(forbiddenPartnerRes.status).toBe(403);

    const viewAllRes = await request(app)
      .get('/api/v1/payments?viewAll=true')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(viewAllRes.status).toBe(200);
    expect(viewAllRes.body.data.some((p) => p.booking_id === booking.id)).toBe(
      true,
    );

    const forbiddenViewAllRes = await request(app)
      .get('/api/v1/payments?viewAll=true')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(forbiddenViewAllRes.status).toBe(403);
  });
});

describe('Refunds', () => {
  test('a customer cannot create a refund (403) — Admin-only per Phase 16 spec §17', async () => {
    const booking = await createBookingFixture(customer);
    const payment = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const res = await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ amount: '1000.00' });
    expect(res.status).toBe(403);
  });

  test('a full refund transitions the payment to REFUNDED and the booking to REFUNDED_ONLINE', async () => {
    const booking = await createBookingFixture(customer, 15_000);
    const payment = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const refundRes = await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ amount: '15000.00', reason: 'customer requested cancellation' });
    expect(refundRes.status).toBe(201);
    expect(refundRes.body.data.status).toBe('SUCCEEDED');
    expect(refundRes.body.data.refund_reference).toMatch(
      /^RF-\d{8}-[A-Z2-9]{8}$/,
    );

    const paymentRes = await request(app)
      .get(`/api/v1/payments/${payment.body.data.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(paymentRes.body.data.status).toBe('REFUNDED');
    expect(paymentRes.body.data.refunded_amount).toBe('15000.00');
    expect(paymentRes.body.data.refundable_amount).toBe('0.00');

    const bookingRes = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(bookingRes.body.data.payment_status).toBe('REFUNDED_ONLINE');
  });

  test('a partial refund transitions the payment to PARTIALLY_REFUNDED and the booking to PARTIALLY_REFUNDED_ONLINE, and stacks to a full refund', async () => {
    const booking = await createBookingFixture(customer, 20_000);
    const payment = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const refundRes = await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ amount: '5000.00' });
    expect(refundRes.status).toBe(201);

    const paymentRes = await request(app)
      .get(`/api/v1/payments/${payment.body.data.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(paymentRes.body.data.status).toBe('PARTIALLY_REFUNDED');
    expect(paymentRes.body.data.refunded_amount).toBe('5000.00');
    expect(paymentRes.body.data.refundable_amount).toBe('15000.00');

    const bookingRes = await request(app)
      .get(`/api/v1/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(bookingRes.body.data.payment_status).toBe(
      'PARTIALLY_REFUNDED_ONLINE',
    );

    // A second partial refund for exactly the remaining balance closes it
    // out to fully REFUNDED.
    const secondRefundRes = await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ amount: '15000.00' });
    expect(secondRefundRes.status).toBe(201);

    const finalPaymentRes = await request(app)
      .get(`/api/v1/payments/${payment.body.data.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(finalPaymentRes.body.data.status).toBe('REFUNDED');
    expect(finalPaymentRes.body.data.refundable_amount).toBe('0.00');
  });

  test('a refund exceeding the refundable balance is rejected with 422 REFUND_EXCEEDS_REFUNDABLE, no partial state change', async () => {
    const booking = await createBookingFixture(customer, 10_000);
    const payment = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const res = await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ amount: '10000.01' });
    expect(res.status).toBe(422);
    expect(
      res.body.error.details.some(
        (d) => d.issue === 'REFUND_EXCEEDS_REFUNDABLE',
      ),
    ).toBe(true);

    const paymentRes = await request(app)
      .get(`/api/v1/payments/${payment.body.data.id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(paymentRes.body.data.status).toBe('SUCCEEDED');
    expect(paymentRes.body.data.refunded_amount).toBe('0.00');
  });

  test('cannot refund a payment that never succeeded (409 PAYMENT_NOT_REFUNDABLE)', async () => {
    const booking = await createBookingFixture(customer);
    const payment = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'DECLINE' });

    const res = await request(app)
      .post(`/api/v1/payments/${payment.body.data.id}/refunds`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ amount: '1.00' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('PAYMENT_NOT_REFUNDABLE');
  });
});

describe('Ledger + partner balance', () => {
  test('a successful payment accrues a partner-payable ledger entry visible via the partner balance endpoint', async () => {
    const booking = await createBookingFixture(customer, 7_500);
    await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ bookingId: booking.id, simulateScenario: 'SUCCESS' });

    const balanceRes = await request(app)
      .get(`/api/v1/payments/partners/${partnerId}/balance`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(balanceRes.status).toBe(200);
    const amdBalance = balanceRes.body.data.balances.find(
      (b) => b.currency === 'AMD',
    );
    expect(amdBalance).toBeDefined();
    expect(Number(amdBalance.balance)).toBeGreaterThanOrEqual(7_500);
  });

  test("a stranger cannot view another partner's balance without payment.view", async () => {
    const res = await request(app)
      .get(`/api/v1/payments/partners/${partnerId}/balance`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('admin (payment.view) can list ledger entries platform-wide', async () => {
    const res = await request(app)
      .get('/api/v1/payments/ledger')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
