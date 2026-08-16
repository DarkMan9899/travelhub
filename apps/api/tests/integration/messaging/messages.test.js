/**
 * Phase 14 (Messaging Platform): the Message module's real endpoints —
 * sending, backward-paginated history, soft-delete (own message or
 * `messaging.moderate`), reactions, and search — all scoped through a
 * real conversation created via the Conversation API.
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

let admin;
let vendor;
let customer;
let vendorUserId;
let outsider;

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

  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );
  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const outsiderEmail = 'messages-outsider@example.com';
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

describe('Messages', () => {
  test('a participant can send a message and the other participant can list it', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);

    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'Hello, is the room available?' });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.body).toBe('Hello, is the room available?');

    const listRes = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(1);
    expect(listRes.body.data[0].body).toBe('Hello, is the room available?');
  });

  test('a message thread returns oldest-first within a page', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'first' });
    await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ body: 'second' });

    const listRes = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.body.data.map((m) => m.body)).toEqual(['first', 'second']);
  });

  test('a non-participant cannot send a message', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const res = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .send({ body: 'sneaky' });
    expect(res.status).toBe(403);
  });

  test('an empty message body is rejected', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const res = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: '' });
    expect(res.status).toBe(422);
  });

  test('the sender can soft-delete their own message', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'to be deleted' });
    const messageId = sendRes.body.data.id;

    const deleteRes = await request(app)
      .delete(
        `/api/v1/messaging/conversations/${conversationId}/messages/${messageId}`,
      )
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.body.data.some((m) => m.id === messageId)).toBe(false);
  });

  test('a non-sender without messaging.moderate cannot delete the message', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'protected' });
    const messageId = sendRes.body.data.id;

    const res = await request(app)
      .delete(
        `/api/v1/messaging/conversations/${conversationId}/messages/${messageId}`,
      )
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('an admin with messaging.moderate can delete any message', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'reported content' });
    const messageId = sendRes.body.data.id;

    const res = await request(app)
      .delete(
        `/api/v1/messaging/conversations/${conversationId}/messages/${messageId}`,
      )
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(204);
  });

  test('a participant can react to a message and toggling again removes it', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'react to me' });
    const messageId = sendRes.body.data.id;

    const reactRes = await request(app)
      .post(
        `/api/v1/messaging/conversations/${conversationId}/messages/${messageId}/reactions`,
      )
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ reactionCode: '👍' });
    expect(reactRes.status).toBe(200);
    expect(reactRes.body.data.added).toBe(true);
    expect(reactRes.body.data.reactions).toHaveLength(1);

    const unreactRes = await request(app)
      .post(
        `/api/v1/messaging/conversations/${conversationId}/messages/${messageId}/reactions`,
      )
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ reactionCode: '👍' });
    expect(unreactRes.body.data.added).toBe(false);
    expect(unreactRes.body.data.reactions).toHaveLength(0);
  });

  test('an invalid reaction code is rejected', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const sendRes = await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: 'react to me' });
    const messageId = sendRes.body.data.id;

    const res = await request(app)
      .post(
        `/api/v1/messaging/conversations/${conversationId}/messages/${messageId}/reactions`,
      )
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ reactionCode: 'not-a-real-emoji' });
    expect(res.status).toBe(422);
  });

  test('search finds a message only within the searching user’s own conversations', async () => {
    const conversationId = await createConversation(customer.accessToken, [
      vendorUserId,
    ]);
    const uniqueBody = `unique-search-token-${Date.now()}`;
    await request(app)
      .post(`/api/v1/messaging/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ body: uniqueBody });

    const foundRes = await request(app)
      .get(`/api/v1/messaging/messages/search?q=${uniqueBody}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(foundRes.status).toBe(200);
    expect(foundRes.body.data.some((m) => m.body === uniqueBody)).toBe(true);

    const notFoundRes = await request(app)
      .get(`/api/v1/messaging/messages/search?q=${uniqueBody}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(notFoundRes.body.data).toHaveLength(0);
  });

  test('requires authentication', async () => {
    const res = await request(app).get(
      '/api/v1/messaging/conversations/1/messages',
    );
    expect(res.status).toBe(401);
  });
});
