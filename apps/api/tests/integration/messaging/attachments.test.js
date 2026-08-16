/**
 * Phase 14 (Messaging Platform), Stage 14.3: attachments (two-step upload
 * -> reference by media id when sending a message) and the ephemeral,
 * Redis-only typing indicator. Mirrors
 * `tests/integration/listings/listingMedia.test.js`'s upload-test style.
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
import {
  getRedisClient,
  closeRedisConnection,
} from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';
import { DEV_CREDENTIALS } from '../../../src/infrastructure/database/seeds/005_dev_accounts.js';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let vendor;
let customer;
let outsider;
let vendorUserId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
}

async function createConversation(token, participantUserIds) {
  const res = await request(app)
    .post('/api/v1/messaging/conversations')
    .set('Authorization', `Bearer ${token}`)
    .send({ participantUserIds });
  return res.body.data.id;
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();

  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const outsiderEmail = 'attachments-outsider@example.com';
  await request(app).post('/api/v1/auth/register').send({
    email: outsiderEmail,
    password: 'StrongPass!2024',
    firstName: 'Out',
    lastName: 'Sider',
  });
  outsider = await login(outsiderEmail, 'StrongPass!2024');

  const pool = getMysqlPool();
  const [[vendorRow]] = await pool.query(
    'SELECT id FROM users WHERE email = ?',
    [DEV_CREDENTIALS.vendor.email],
  );
  vendorUserId = vendorRow.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Message attachments', () => {
  test('a participant can upload an attachment and reference it when sending a message', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const uploadRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/attachments`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.data.media_type).toBe('IMAGE');
    const mediaId = uploadRes.body.data.id;

    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'see attached', attachmentMediaIds: [mediaId] });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.attachments).toHaveLength(1);
    expect(sendRes.body.data.attachments[0].id).toBe(mediaId);

    const listRes = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(listRes.body.data[0].attachments).toHaveLength(1);
    expect(listRes.body.data[0].attachments[0].media_type).toBe('IMAGE');
  });

  test('an attachment-only message (no caption) is accepted', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const uploadRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/attachments`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(uploadRes.status).toBe(201);
    const mediaId = uploadRes.body.data.id;

    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: '', attachmentMediaIds: [mediaId] });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.attachments).toHaveLength(1);
  });

  test('a message with neither a body nor an attachment is rejected', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: '' });
    expect(sendRes.status).toBe(422);
  });

  test('a non-participant cannot upload an attachment', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const res = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/attachments`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(res.status).toBe(403);
  });

  test('rejects an unsupported content type', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const res = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/attachments`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .set('Content-Type', 'application/zip')
      .send(Buffer.from('not really a zip'));
    expect([415, 422]).toContain(res.status);
  });

  test('an attachment uploaded to one conversation cannot be re-parented onto a message in another', async () => {
    const conversationA = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const conversationB = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const uploadRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationA}/attachments`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    const mediaId = uploadRes.body.data.id;

    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationB}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'wrong conversation', attachmentMediaIds: [mediaId] });
    expect(sendRes.status).toBe(201);
    // The mismatched media id silently fails to re-parent (guarded at the
    // repository level) rather than attaching cross-conversation media.
    expect(sendRes.body.data.attachments).toHaveLength(0);
  });

  test('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/messaging/conversations/1/attachments')
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(res.status).toBe(401);
  });
});

describe('Typing indicator', () => {
  afterAll(async () => {
    const redis = getRedisClient();
    const keys = await redis.keys('typing:*');
    if (keys.length > 0) await redis.del(keys);
  });

  test('a participant setting typing is visible to the other participant, not to themselves', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const setRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/typing`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(setRes.status).toBe(204);

    const vendorView = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/typing`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(vendorView.status).toBe(200);
    expect(vendorView.body.data.typing_user_ids).toHaveLength(1);

    const customerView = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/typing`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(customerView.body.data.typing_user_ids).toHaveLength(0);
  });

  test('a non-participant cannot set or read typing state', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const setRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/typing`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(setRes.status).toBe(403);

    const getRes = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/typing`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(getRes.status).toBe(403);
  });

  test('requires authentication', async () => {
    const res = await request(app).get(
      '/api/v1/messaging/conversations/1/typing',
    );
    expect(res.status).toBe(401);
  });
});
