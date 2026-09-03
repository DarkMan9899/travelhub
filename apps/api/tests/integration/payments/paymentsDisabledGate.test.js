/**
 * Stripe go-live preflight — go-live sequencing: the marketplace can
 * launch with `PAYMENTS_ENABLED=false` (the production default — see
 * config/index.js). This file forces that env var to `false` BEFORE
 * `app.js`/`config/index.js` are ever evaluated (`cleanEnv` reads
 * `process.env` once, at import time), so every static top-level import
 * in this file must be avoided in favor of a dynamic `import()` inside
 * `beforeAll` — Jest gives each test file its own module registry, so
 * this doesn't leak into `paymentLifecycle.test.js`'s (which relies on
 * the default `PAYMENTS_ENABLED=true` in test/development).
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';

let app;
let up;
let seedAll;
let closeMysqlPool;
let closeRedisConnection;
let resetRateLimits;

async function registerCustomer(label) {
  const email = `payments-disabled-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'PaymentsFixture!2024',
    firstName: 'Payments',
    lastName: label,
  });
  return { accessToken: res.body.data.access_token };
}

let customer;

beforeAll(async () => {
  process.env.PAYMENTS_ENABLED = 'false';

  ({ default: app } = await import('../../../src/app.js'));
  ({ up } = await import('../../../src/infrastructure/database/migrate.js'));
  ({ seedAll } =
    await import('../../../src/infrastructure/database/seeds/index.js'));
  ({ closeMysqlPool } =
    await import('../../../src/infrastructure/database/mysqlPool.js'));
  ({ closeRedisConnection } =
    await import('../../../src/infrastructure/cache/redisClient.js'));
  ({ resetRateLimits } = await import('../helpers/resetRateLimits.js'));

  await up();
  await seedAll();
  await resetRateLimits();
  customer = await registerCustomer('customer');
}, 60_000);

afterAll(async () => {
  delete process.env.PAYMENTS_ENABLED;
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Go-live sequencing: PAYMENTS_ENABLED=false', () => {
  test('GET /payments/config reports payments as disabled, publicly (no auth required)', async () => {
    const res = await request(app).get('/api/v1/payments/config');
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);
  });

  test('POST /payments (checkout) is refused with 503 PAYMENTS_DISABLED before ever looking up the booking', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      // A bookingId that cannot possibly exist — a 404 here would mean
      // the disabled-check ran too late (after a real booking lookup);
      // the guard must fire first.
      .send({ bookingId: 999_999_999, simulateScenario: 'SUCCESS' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENTS_DISABLED');
  });

  test('POST /payments/:id/refunds (admin action) is refused with 503 PAYMENTS_DISABLED before ever looking up the payment', async () => {
    const res = await request(app)
      .post('/api/v1/payments/999999999/refunds')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ amount: '1.00' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('PAYMENTS_DISABLED');
  });
});
