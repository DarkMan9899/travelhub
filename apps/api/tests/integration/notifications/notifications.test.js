/**
 * Phase 13 (Notifications): the Notifications module's real endpoints.
 * There is no public "create" endpoint — creation only happens via
 * `events/notificationListener.js` reacting to a published domain event
 * (Stage 13.4) — so this suite seeds rows directly against the test
 * database, the same way other integration suites seed reference data
 * they don't own an HTTP-writable path to.
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
let customer;
let customerUserId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
}

async function seedNotification(recipientUserId, overrides = {}) {
  const pool = getMysqlPool();
  const {
    eventId = null,
    eventType = 'booking.created',
    categoryCode = 'BOOKING',
    priorityCode = 'NORMAL',
    payload = { bookingReference: 'BK-TEST' },
  } = overrides;
  const [result] = await pool.query(
    `INSERT INTO notifications
       (recipient_user_id, event_id, event_type, category_id, priority_id, payload, metadata)
     VALUES (?, ?, ?,
       (SELECT id FROM notification_categories WHERE code = ?),
       (SELECT id FROM notification_priorities WHERE code = ?),
       ?, ?)`,
    [
      recipientUserId,
      eventId,
      eventType,
      categoryCode,
      priorityCode,
      JSON.stringify(payload),
      JSON.stringify({}),
    ],
  );
  return result.insertId;
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();

  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const pool = getMysqlPool();
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

describe('Notifications', () => {
  test('every endpoint requires authentication', async () => {
    const listRes = await request(app).get('/api/v1/notifications');
    expect(listRes.status).toBe(401);
    const unreadRes = await request(app).get(
      '/api/v1/notifications/unread-count',
    );
    expect(unreadRes.status).toBe(401);
  });

  test('lists a recipient’s own notifications, newest first', async () => {
    const firstId = await seedNotification(customerUserId, {
      eventType: 'favorite.added',
      categoryCode: 'FAVORITE',
    });
    const secondId = await seedNotification(customerUserId, {
      eventType: 'booking.confirmed',
      categoryCode: 'BOOKING',
    });

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${customer.accessToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((row) => row.id);
    expect(ids.indexOf(secondId)).toBeLessThan(ids.indexOf(firstId));
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        event_type: 'booking.confirmed',
        category: 'BOOKING',
        is_read: false,
      }),
    );
  });

  test('filters by category', async () => {
    await seedNotification(customerUserId, {
      eventType: 'review.submitted',
      categoryCode: 'REVIEW',
    });

    const res = await request(app)
      .get('/api/v1/notifications?category=REVIEW')
      .set('Authorization', `Bearer ${customer.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((row) => expect(row.category).toBe('REVIEW'));
  });

  test('unread-count reflects seeded unread rows and drops after mark-all-read', async () => {
    const beforeRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(beforeRes.body.data.unread_count).toBeGreaterThan(0);

    const markAllRes = await request(app)
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(markAllRes.status).toBe(204);

    const afterRes = await request(app)
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(afterRes.body.data.unread_count).toBe(0);
  });

  test('marks a single notification as read', async () => {
    const id = await seedNotification(customerUserId);
    const res = await request(app)
      .patch(`/api/v1/notifications/${id}/read`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_read).toBe(true);
  });

  test('archives a notification and it no longer appears in the unread list', async () => {
    const id = await seedNotification(customerUserId);
    const archiveRes = await request(app)
      .patch(`/api/v1/notifications/${id}/archive`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.data.is_archived).toBe(true);

    const unreadListRes = await request(app)
      .get('/api/v1/notifications?status=unread')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(unreadListRes.body.data.map((row) => row.id)).not.toContain(id);

    const archivedListRes = await request(app)
      .get('/api/v1/notifications?status=archived')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(archivedListRes.body.data.map((row) => row.id)).toContain(id);
  });

  test('soft-deletes a notification and it disappears from every list', async () => {
    const id = await seedNotification(customerUserId);
    const deleteRes = await request(app)
      .delete(`/api/v1/notifications/${id}`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(deleteRes.status).toBe(204);

    const listRes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.body.data.map((row) => row.id)).not.toContain(id);
  });

  test('returns 404 when acting on another recipient’s notification', async () => {
    const adminUserRes = await getMysqlPool().query(
      'SELECT id FROM users WHERE email = ?',
      [DEV_CREDENTIALS.admin.email],
    );
    const adminUserId = adminUserRes[0][0].id;
    const otherId = await seedNotification(adminUserId);

    const res = await request(app)
      .patch(`/api/v1/notifications/${otherId}/read`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(404);
  });

  test('preferences default every category to enabled, then persist an override', async () => {
    const listRes = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toEqual(
      expect.arrayContaining([
        { category: 'BOOKING', in_app_enabled: true, email_enabled: true },
      ]),
    );

    const updateRes = await request(app)
      .patch('/api/v1/notifications/preferences/BOOKING')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ inAppEnabled: true, emailEnabled: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data).toEqual({
      category: 'BOOKING',
      in_app_enabled: true,
      email_enabled: false,
    });

    const afterRes = await request(app)
      .get('/api/v1/notifications/preferences')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(afterRes.body.data).toEqual(
      expect.arrayContaining([
        { category: 'BOOKING', in_app_enabled: true, email_enabled: false },
      ]),
    );
  });

  test('rejects an announcement from a non-admin principal with 403', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/announcements')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ audience: { type: 'ALL' }, payload: { title: 'Hi' } });
    expect(res.status).toBe(403);
  });

  test('an admin announcement reaches every user, including the customer', async () => {
    const createRes = await request(app)
      .post('/api/v1/notifications/announcements')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        audience: { type: 'ALL' },
        payload: { title: 'Scheduled maintenance', body: 'Tonight at 2am.' },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.recipient_count).toBeGreaterThan(0);

    const listRes = await request(app)
      .get('/api/v1/notifications?category=ADMIN')
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(listRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: 'admin.announcement',
          payload: expect.objectContaining({ title: 'Scheduled maintenance' }),
        }),
      ]),
    );
  });
});
