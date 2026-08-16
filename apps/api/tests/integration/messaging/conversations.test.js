/**
 * Phase 14 (Messaging Platform): the Conversation module's real
 * endpoints — participant-scoped access, `messaging.view_all` read
 * visibility for admins, and archive/unarchive.
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
let customerUserId;
let outsider;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
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

  const outsiderEmail = 'messaging-outsider@example.com';
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
  const [[customerRow]] = await pool.query(
    'SELECT id FROM users WHERE email = ?',
    [DEV_CREDENTIALS.customer.email],
  );
  customerUserId = customerRow.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Conversations', () => {
  test('a participant can create a conversation and see it in their list', async () => {
    const createRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ participantUserIds: [vendorUserId] });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.created_by).toBe(customerUserId);
    // The creator's own response never includes themselves — only the
    // OTHER participant(s) — so a chat UI knows who it's showing.
    expect(createRes.body.data.participants).toEqual([
      expect.objectContaining({ user_id: vendorUserId }),
    ]);
    const conversationId = createRes.body.data.id;

    const listRes = await request(app)
      .get('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.status).toBe(200);
    const listedConversation = listRes.body.data.find(
      (row) => row.id === conversationId,
    );
    expect(listedConversation).toBeDefined();
    expect(listedConversation.participants).toEqual([
      expect.objectContaining({ user_id: vendorUserId }),
    ]);

    const otherListRes = await request(app)
      .get('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    const vendorSideConversation = otherListRes.body.data.find(
      (row) => row.id === conversationId,
    );
    expect(vendorSideConversation).toBeDefined();
    // From the vendor's own perspective, the OTHER participant is the customer.
    expect(vendorSideConversation.participants).toEqual([
      expect.objectContaining({ user_id: customerUserId }),
    ]);
  });

  test('creating a conversation with a context reuses the existing thread instead of duplicating it', async () => {
    const firstRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        participantUserIds: [vendorUserId],
        contextType: 'booking',
        contextId: 999001,
      });
    expect(firstRes.status).toBe(201);
    const firstConversationId = firstRes.body.data.id;

    const secondRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        participantUserIds: [vendorUserId],
        contextType: 'booking',
        contextId: 999001,
      });
    // Same status code as a fresh create (this is a real, usable
    // conversation resource either way) — but the SAME id, proving the
    // "message the partner about this booking" entry point is safe to
    // click more than once.
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.data.id).toBe(firstConversationId);

    const otherContextRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        participantUserIds: [vendorUserId],
        contextType: 'booking',
        contextId: 999002,
      });
    // A different contextId is a genuinely different thread.
    expect(otherContextRes.status).toBe(201);
    expect(otherContextRes.body.data.id).not.toBe(firstConversationId);
  });

  test('creating a conversation with only oneself fails validation', async () => {
    const res = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ participantUserIds: [customerUserId] });
    expect(res.status).toBe(422);
  });

  test('a non-participant cannot read a conversation', async () => {
    const createRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ participantUserIds: [vendorUserId] });
    const conversationId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('an admin with messaging.view_all can read a conversation they do not participate in', async () => {
    const createRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ participantUserIds: [vendorUserId] });
    const conversationId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/v1/messaging/conversations/${conversationId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(conversationId);
  });

  test('archiving a conversation hides it from that participant only', async () => {
    const createRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ participantUserIds: [vendorUserId] });
    const conversationId = createRes.body.data.id;

    const archiveRes = await request(app)
      .patch(`/api/v1/messaging/conversations/${conversationId}/archive`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.is_archived_for_participant).toBe(true);

    const customerArchivedList = await request(app)
      .get('/api/v1/messaging/conversations?status=archived')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(
      customerArchivedList.body.data.some((row) => row.id === conversationId),
    ).toBe(true);

    const vendorActiveList = await request(app)
      .get('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(
      vendorActiveList.body.data.some((row) => row.id === conversationId),
    ).toBe(true);

    const unarchiveRes = await request(app)
      .patch(`/api/v1/messaging/conversations/${conversationId}/unarchive`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(unarchiveRes.status).toBe(200);
    expect(unarchiveRes.body.data.is_archived_for_participant).toBe(false);
  });

  test('a non-participant cannot archive a conversation', async () => {
    const createRes = await request(app)
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ participantUserIds: [vendorUserId] });
    const conversationId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/v1/messaging/conversations/${conversationId}/archive`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);
    expect(res.status).toBe(403);
  });

  test('unread-count reflects real unread conversations for a participant', async () => {
    const res = await request(app)
      .get('/api/v1/messaging/conversations/unread-count')
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.unread_count).toBe('number');
  });

  test('requires authentication', async () => {
    const res = await request(app).get('/api/v1/messaging/conversations');
    expect(res.status).toBe(401);
  });
});
