/**
 * Sprint 6: "Update profile," "Change password," "Avatar field support."
 * Implements API_SPECIFICATION.md §28 and the Service-layer ownership
 * check described in BACKEND_ARCHITECTURE.md §13 ("Owner or
 * `{permission}`").
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import { closeMysqlPool } from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

async function registerUser(prefix) {
  const email = uniqueEmail(prefix);
  const password = 'StrongPass!2024';
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'Test', lastName: prefix });
  return {
    email,
    password,
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

let userA;
let userB;

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();
  userA = await registerUser('profile-a');
  userB = await registerUser('profile-b');
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('PATCH /users/:id — ownership enforcement', () => {
  test('a user can update their own profile', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${userA.userId}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ firstName: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.data.first_name).toBe('Updated');
  });

  test("a user cannot update another user's profile (403)", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${userB.userId}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({ firstName: 'Hijacked' });

    expect(res.status).toBe(403);
  });

  test('an unauthenticated request is rejected with 401', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${userA.userId}`)
      .send({ firstName: 'Nope' });
    expect(res.status).toBe(401);
  });

  test('an empty body is rejected with 422 (at least one field required)', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${userA.userId}`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({});
    expect(res.status).toBe(422);
  });
});

describe('POST /users/:id/change-password — owner-only, no permission fallback', () => {
  test('the owner can change their own password with the correct current password', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userA.userId}/change-password`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        currentPassword: userA.password,
        newPassword: 'NewStrongPass!2024',
      });

    expect(res.status).toBe(200);
    expect(res.body.data.changed).toBe(true);

    const loginWithNewPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userA.email, password: 'NewStrongPass!2024' });
    expect(loginWithNewPassword.status).toBe(200);
  });

  test('rejects the wrong current password with 401 INVALID_CREDENTIALS', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userB.userId}/change-password`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({
        currentPassword: 'NotTheRealPassword!1',
        newPassword: 'AnotherStrongPass!2024',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test("another user cannot change this user's password, even with permission-shaped intent (403)", async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userB.userId}/change-password`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .send({
        currentPassword: userB.password,
        newPassword: 'AnotherStrongPass!2024',
      });

    expect(res.status).toBe(403);
  });
});

describe('POST /users/:id/avatar — local storage abstraction end-to-end', () => {
  test('uploads a small PNG, stores it locally, and sets avatar_media_id', async () => {
    // A minimal valid 1x1 transparent PNG.
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );

    const res = await request(app)
      .post(`/api/v1/users/${userB.userId}/avatar`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(pngBuffer);

    expect(res.status).toBe(200);
    expect(res.body.data.avatar_media_id).toEqual(expect.any(Number));
  });

  test('rejects an unsupported content type', async () => {
    const res = await request(app)
      .post(`/api/v1/users/${userB.userId}/avatar`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .set('Content-Type', 'application/pdf')
      .send(Buffer.from('%PDF-1.4 not really a pdf'));

    // express.raw() only captures configured image types; anything else
    // never reaches req.body as a Buffer, so validated params still pass
    // but the Buffer check in the controller (or express's own body
    // parsing) rejects it.
    expect([415, 422]).toContain(res.status);
  });

  test("another user cannot set this user's avatar (403)", async () => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    );
    const res = await request(app)
      .post(`/api/v1/users/${userB.userId}/avatar`)
      .set('Authorization', `Bearer ${userA.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(pngBuffer);

    expect(res.status).toBe(403);
  });
});
