/**
 * P1.4 (Master Roadmap) — staff roster, invite-by-email, accept, role
 * changes, and revocation for an already-APPROVED partner. Against the
 * real HTTP API/database, every partner created fresh via the real P1.2
 * onboarding flow (create -> submit -> admin approves).
 */

import {
  describe,
  test,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
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
let pool;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

async function registerUser(label) {
  const email = `staff-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'StaffFixture!2024',
    firstName: 'Staff',
    lastName: label,
  });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
    email,
  };
}

async function createApprovedPartner(owner, displayName) {
  const createRes = await request(app)
    .post('/api/v1/partners/applications')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({
      displayName,
      legalName: `${displayName} LLC`,
      email: 'contact@example.com',
      phone: '+37400000099',
    });
  const partnerId = createRes.body.data.id;
  await request(app)
    .post(`/api/v1/partners/applications/${partnerId}/submit`)
    .set('Authorization', `Bearer ${owner.accessToken}`);
  await request(app)
    .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
    .set('Authorization', `Bearer ${admin.accessToken}`)
    .send({ status: 'APPROVED' });
  return partnerId;
}

async function addStaff(partnerId, userId, roleCode) {
  await pool.query(
    `INSERT INTO partner_employees (partner_id, user_id, role_id, created_by, updated_by)
     VALUES (?, ?, (SELECT id FROM partner_employee_roles WHERE code = ?), ?, ?)`,
    [partnerId, userId, roleCode, userId, userId],
  );
}

/** Extracts the raw invite token out of `invite_url` — the same way a real invitee would from the email link. */
function tokenFromInviteUrl(inviteUrl) {
  return inviteUrl.split('/').pop();
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();
  pool = getMysqlPool();
  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );
}, 60_000);

beforeEach(async () => {
  await resetRateLimits();
});

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Partner staff management (P1.4)', () => {
  test('the owner can invite, the invitee accepts, and both then see each other on the roster', async () => {
    const owner = await registerUser('happyowner');
    const invitee = await registerUser('happyinvitee');
    const partnerId = await createApprovedPartner(owner, 'Dilijan Adventures');

    const inviteRes = await request(app)
      .post(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, roleCode: 'EDITOR', locale: 'en' });
    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.role).toBe('EDITOR');
    expect(inviteRes.body.data.invite_url).toEqual(
      expect.stringContaining('/partner/invitations/'),
    );

    const token = tokenFromInviteUrl(inviteRes.body.data.invite_url);

    // Unauthenticated preview — no auth header at all.
    const previewRes = await request(app).get(
      `/api/v1/partners/invitations/${token}`,
    );
    expect(previewRes.status).toBe(200);
    expect(previewRes.body.data.partner_name).toBe('Dilijan Adventures');
    expect(previewRes.body.data.role_name).toBe('Editor');

    const acceptRes = await request(app)
      .post(`/api/v1/partners/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.data.role).toBe('EDITOR');
    expect(acceptRes.body.data.email).toBe(invitee.email);

    const staffRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/staff`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(staffRes.status).toBe(200);
    const emails = staffRes.body.data.map((row) => row.email);
    expect(emails).toEqual(
      expect.arrayContaining([owner.email, invitee.email]),
    );

    // The invitation no longer shows up as pending.
    const invitationsRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(invitationsRes.body.data).toHaveLength(0);
  });

  test('accepting with a different signed-in email is rejected (403), and the invitation stays pending', async () => {
    const owner = await registerUser('mismatchowner');
    const invitee = await registerUser('mismatchinvitee');
    const stranger = await registerUser('mismatchstranger');
    const partnerId = await createApprovedPartner(owner, 'Sevan Kayaks');

    const inviteRes = await request(app)
      .post(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, roleCode: 'EDITOR', locale: 'en' });
    const token = tokenFromInviteUrl(inviteRes.body.data.invite_url);

    const acceptRes = await request(app)
      .post(`/api/v1/partners/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(acceptRes.status).toBe(403);

    // Still acceptable by the real invitee afterwards.
    const realAcceptRes = await request(app)
      .post(`/api/v1/partners/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(realAcceptRes.status).toBe(200);
  });

  test('an EDITOR can see the roster but cannot invite/change roles/remove (403)', async () => {
    const owner = await registerUser('editorowner');
    const editor = await registerUser('editoreditor');
    const target = await registerUser('editortarget');
    const partnerId = await createApprovedPartner(owner, 'Editor Staff Co');
    await addStaff(partnerId, editor.userId, 'EDITOR');
    await addStaff(partnerId, target.userId, 'ANALYTICS_VIEWER');

    const listRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/staff`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    expect(listRes.status).toBe(200);

    const inviteRes = await request(app)
      .post(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({ email: 'nobody@example.com', roleCode: 'EDITOR', locale: 'en' });
    expect(inviteRes.status).toBe(403);

    const [[targetRow]] = await pool.query(
      'SELECT id FROM partner_employees WHERE partner_id = ? AND user_id = ?',
      [partnerId, target.userId],
    );
    const roleChangeRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/staff/${targetRow.id}`)
      .set('Authorization', `Bearer ${editor.accessToken}`)
      .send({ roleCode: 'MANAGER' });
    expect(roleChangeRes.status).toBe(403);

    const removeRes = await request(app)
      .delete(`/api/v1/partners/${partnerId}/staff/${targetRow.id}`)
      .set('Authorization', `Bearer ${editor.accessToken}`);
    expect(removeRes.status).toBe(403);
  });

  test('a MANAGER can change a peer role and remove them; a removed employee genuinely loses access', async () => {
    const owner = await registerUser('managerowner');
    const manager = await registerUser('managermanager');
    const target = await registerUser('managertarget');
    const partnerId = await createApprovedPartner(owner, 'Manager Staff Co');
    await addStaff(partnerId, manager.userId, 'MANAGER');
    await addStaff(partnerId, target.userId, 'EDITOR');

    const [[targetRow]] = await pool.query(
      'SELECT id FROM partner_employees WHERE partner_id = ? AND user_id = ?',
      [partnerId, target.userId],
    );

    const roleChangeRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/staff/${targetRow.id}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ roleCode: 'BOOKING_MANAGER' });
    expect(roleChangeRes.status).toBe(200);
    expect(roleChangeRes.body.data.role).toBe('BOOKING_MANAGER');

    const removeRes = await request(app)
      .delete(`/api/v1/partners/${partnerId}/staff/${targetRow.id}`)
      .set('Authorization', `Bearer ${manager.accessToken}`);
    expect(removeRes.status).toBe(204);

    // Revoked user genuinely loses access — the profile endpoint (any
    // active member's read gate) now 403s them.
    const profileRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/profile`)
      .set('Authorization', `Bearer ${target.accessToken}`);
    expect(profileRes.status).toBe(403);

    // And they no longer appear on the active roster.
    const staffRes = await request(app)
      .get(`/api/v1/partners/${partnerId}/staff`)
      .set('Authorization', `Bearer ${owner.accessToken}`);
    expect(staffRes.body.data.some((row) => row.email === target.email)).toBe(
      false,
    );
  });

  test('the OWNER row can never be role-changed or removed via this endpoint (403)', async () => {
    const owner = await registerUser('ownerprotectowner');
    const manager = await registerUser('ownerprotectmanager');
    const partnerId = await createApprovedPartner(owner, 'Owner Protect Co');
    await addStaff(partnerId, manager.userId, 'MANAGER');

    const [[ownerRow]] = await pool.query(
      "SELECT pe.id FROM partner_employees pe JOIN partner_employee_roles per ON per.id = pe.role_id WHERE pe.partner_id = ? AND per.code = 'OWNER'",
      [partnerId],
    );

    const roleChangeRes = await request(app)
      .patch(`/api/v1/partners/${partnerId}/staff/${ownerRow.id}`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({ roleCode: 'EDITOR' });
    expect(roleChangeRes.status).toBe(403);

    const removeRes = await request(app)
      .delete(`/api/v1/partners/${partnerId}/staff/${ownerRow.id}`)
      .set('Authorization', `Bearer ${manager.accessToken}`);
    expect(removeRes.status).toBe(403);
  });

  test("a stranger cannot manage another partner's staff, and cross-partner ids never resolve (404, existence not masked differently)", async () => {
    const ownerA = await registerUser('crossownerA');
    const ownerB = await registerUser('crossownerB');
    const partnerA = await createApprovedPartner(ownerA, 'Partner A Co');
    const partnerB = await createApprovedPartner(ownerB, 'Partner B Co');

    const inviteRes = await request(app)
      .post(`/api/v1/partners/${partnerB}/staff/invitations`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ email: 'x@example.com', roleCode: 'EDITOR', locale: 'en' });
    expect(inviteRes.status).toBe(403);

    // B's own invitation id, requested through A's partnerId in the URL,
    // must not be reachable at all.
    const bInviteRes = await request(app)
      .post(`/api/v1/partners/${partnerB}/staff/invitations`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ email: 'y@example.com', roleCode: 'EDITOR', locale: 'en' });
    const bInvitationId = bInviteRes.body.data.id;

    const crossRevokeRes = await request(app)
      .delete(`/api/v1/partners/${partnerA}/staff/invitations/${bInvitationId}`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`);
    expect(crossRevokeRes.status).toBe(404);
  });

  test('inviting the same email twice supersedes the first invitation (old token stops working)', async () => {
    const owner = await registerUser('resendowner');
    const invitee = await registerUser('resendinvitee');
    const partnerId = await createApprovedPartner(owner, 'Resend Co');

    const firstInviteRes = await request(app)
      .post(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, roleCode: 'EDITOR', locale: 'en' });
    const firstToken = tokenFromInviteUrl(firstInviteRes.body.data.invite_url);

    const secondInviteRes = await request(app)
      .post(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: invitee.email, roleCode: 'MANAGER', locale: 'en' });
    expect(secondInviteRes.status).toBe(201);

    const staleAcceptRes = await request(app)
      .post(`/api/v1/partners/invitations/${firstToken}/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(staleAcceptRes.status).toBe(404);

    const secondToken = tokenFromInviteUrl(
      secondInviteRes.body.data.invite_url,
    );
    const freshAcceptRes = await request(app)
      .post(`/api/v1/partners/invitations/${secondToken}/accept`)
      .set('Authorization', `Bearer ${invitee.accessToken}`);
    expect(freshAcceptRes.status).toBe(200);
    expect(freshAcceptRes.body.data.role).toBe('MANAGER');
  });

  test('inviting the OWNER role is rejected (422)', async () => {
    const owner = await registerUser('noownerowner');
    const partnerId = await createApprovedPartner(owner, 'No Owner Invite Co');

    const res = await request(app)
      .post(`/api/v1/partners/${partnerId}/staff/invitations`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ email: 'x@example.com', roleCode: 'OWNER', locale: 'en' });
    expect(res.status).toBe(422);
  });
});
