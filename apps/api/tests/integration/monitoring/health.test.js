/**
 * Sprint 1 scope: proves the full Express app (real middleware chain,
 * real config loader) responds correctly end-to-end via a real HTTP
 * request — the integration-test equivalent of the unit-test harness
 * proof in tests/unit/errors/AppError.test.js.
 *
 * Implements the health check contract from BACKEND_ARCHITECTURE.md §50
 * and is the specific check named in SPRINT_0_IMPLEMENTATION_PLAN.md §19's
 * acceptance criteria ("GET /health/live and /health/ready respond
 * correctly").
 */

import { describe, test, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../../src/app.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { closeMysqlPool } from '../../../src/infrastructure/database/mysqlPool.js';

afterAll(async () => {
  // Integration tests open real Redis/MySQL client connections via the app's
  // health routes; close them explicitly so Jest can exit cleanly rather
  // than reporting an open-handle warning (BACKEND_ARCHITECTURE.md §56's
  // integration-test discipline — no shared, stateful infrastructure is
  // left dangling between test runs).
  await closeRedisConnection();
  await closeMysqlPool();
});

describe('Health check routes (BACKEND_ARCHITECTURE.md §50)', () => {
  test('GET /health/live returns 200 with a minimal liveness payload', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'live' });
  });

  test('GET /health/ready returns the standard envelope with dependency checks', async () => {
    const res = await request(app).get('/health/ready');
    // In CI this runs against real MySQL/Redis service containers
    // (.github/workflows/ci.yml); locally it reflects whatever
    // `docker compose up -d` has running — so both outcomes are valid
    // depending on environment, but the envelope shape must always hold.
    expect([200, 503]).toContain(res.status);
    expect(res.body.data).toHaveProperty('status');
    expect(res.body.data).toHaveProperty('checks');
    expect(res.body.data.checks).toHaveProperty('mysql');
    expect(res.body.data.checks).toHaveProperty('redis');
    if (res.status === 503) {
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    }
  });

  test('an unmatched route returns the standard 404 error envelope', async () => {
    const res = await request(app).get('/this-route-does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.request_id).toBeDefined();
  });
});
