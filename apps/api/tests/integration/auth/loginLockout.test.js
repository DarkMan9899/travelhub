/**
 * Sprint 6 §"Security": login-attempt lockout.
 * Implements BACKEND_ARCHITECTURE.md §12 / API_SPECIFICATION.md §27:
 * "5 consecutive failures within 15 minutes triggers a temporary
 * lockout (ACCOUNT_LOCKED, 423) independent of the general rate limit."
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import { closeMysqlPool } from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';

const email = `lockout-${Date.now()}@example.com`;
const password = 'StrongPass!2024';

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();
  await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Lock', lastName: 'Out' });
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Login lockout after 5 consecutive failures', () => {
  test('5 consecutive wrong-password attempts each return 401, the 6th (even with the correct password) returns 423 ACCOUNT_LOCKED', async () => {
    // eslint-disable-next-line no-restricted-syntax -- attempts must happen strictly in order
    for (let attempt = 0; attempt < 5; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: 'WrongPassword!1' });
      expect(res.status).toBe(401);
    }

    const lockedRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(lockedRes.status).toBe(423);
    expect(lockedRes.body.error.code).toBe('ACCOUNT_LOCKED');
  }, 30_000);
});
