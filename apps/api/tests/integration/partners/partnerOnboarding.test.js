/**
 * P1.2 (Master Roadmap) — self-service partner onboarding.
 * DRAFT -> PENDING -> APPROVED/REJECTED/NEEDS_CHANGES -> (resubmit) ->
 * PENDING, against the real HTTP API, real database, no seed-data
 * dependency (every applicant here is a throwaway registered user).
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
  return { accessToken: res.body.data.access_token };
}

async function registerApplicant(label) {
  const email = `onboarding-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await request(app).post('/api/v1/auth/register').send({
    email,
    password: 'OnboardingFixture!2024',
    firstName: 'Onboarding',
    lastName: label,
  });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
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

// Every test registers at least one fresh throwaway applicant against
// auth's own real sensitiveRateLimiter (10/min, shared across this
// whole file's requests) — a single beforeAll reset isn't enough once
// there are more than ~10 register/login calls total across the file
// (mirrors paymentLifecycle.test.js's identical documented reasoning).
beforeEach(async () => {
  await resetRateLimits();
});

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Partner onboarding (P1.2)', () => {
  test('POST /partners/applications requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/partners/applications')
      .send({ displayName: 'No Auth Co' });
    expect(res.status).toBe(401);
  });

  test('the full happy path: apply -> save draft edits -> submit -> admin approves -> becomes publicly visible', async () => {
    const applicant = await registerApplicant('happy');

    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'Happy Path Tours' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.verification_status).toBe('DRAFT');
    expect(createRes.body.data.moderation_status).toBe('PENDING');
    const partnerId = createRes.body.data.id;

    // A DRAFT with no email/phone yet cannot be submitted.
    const earlySubmit = await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    expect(earlySubmit.status).toBe(422);

    const editRes = await request(app)
      .patch(`/api/v1/partners/applications/${partnerId}`)
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({
        legalName: 'Happy Path Tours LLC',
        email: 'contact@happypathtours.example',
        phone: '+37400000001',
        description: 'Guided tours across Armenia.',
      });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.legal_name).toBe('Happy Path Tours LLC');

    const submitRes = await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.data.verification_status).toBe('PENDING');

    // Not editable once submitted.
    const editAfterSubmit = await request(app)
      .patch(`/api/v1/partners/applications/${partnerId}`)
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'Should not apply' });
    expect(editAfterSubmit.status).toBe(409);

    // Not yet publicly visible while PENDING.
    const [[row]] = await pool.query('SELECT slug FROM partners WHERE id = ?', [
      partnerId,
    ]);
    const preApprovalPublic = await request(app).get(
      `/api/v1/partners/${row.slug}`,
    );
    expect(preApprovalPublic.status).toBe(404);

    const approveRes = await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'APPROVED' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.verification_status).toBe('APPROVED');
    // The one moment moderation_status must also flip — see
    // mysqlPartnerRepository.js#updateVerificationStatus's
    // alsoApproveModerationStatus comment.
    expect(approveRes.body.data.moderation_status).toBe('APPROVED');

    const postApprovalPublic = await request(app).get(
      `/api/v1/partners/${row.slug}`,
    );
    expect(postApprovalPublic.status).toBe(200);
    expect(postApprovalPublic.body.data.display_name).toBe('Happy Path Tours');
  });

  test('admin rejects a submitted application', async () => {
    const applicant = await registerApplicant('rejected');
    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({
        displayName: 'Reject Me Co',
        legalName: 'Reject Me Co LLC',
        email: 'contact@rejectme.example',
        phone: '+37400000002',
      });
    const partnerId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);

    const rejectRes = await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        status: 'REJECTED',
        reviewNote: 'Not a fit for the marketplace.',
      });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.verification_status).toBe('REJECTED');
    expect(rejectRes.body.data.review_note).toBe(
      'Not a fit for the marketplace.',
    );

    // A REJECTED application is no longer owner-editable.
    const editRes = await request(app)
      .patch(`/api/v1/partners/applications/${partnerId}`)
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'Try again' });
    expect(editRes.status).toBe(409);
  });

  test('needs-changes requires a note, routes back to the applicant, and resubmitting clears it', async () => {
    const applicant = await registerApplicant('needschanges');
    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({
        displayName: 'Needs Changes Co',
        legalName: 'Needs Changes Co LLC',
        email: 'contact@needschanges.example',
        phone: '+37400000003',
      });
    const partnerId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);

    const noNoteRes = await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'NEEDS_CHANGES' });
    expect(noNoteRes.status).toBe(422);

    const needsChangesRes = await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        status: 'NEEDS_CHANGES',
        reviewNote: 'Please add a phone number format.',
      });
    expect(needsChangesRes.status).toBe(200);
    expect(needsChangesRes.body.data.verification_status).toBe('NEEDS_CHANGES');

    // Now owner-editable again.
    const editRes = await request(app)
      .patch(`/api/v1/partners/applications/${partnerId}`)
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ phone: '+374 00 000004' });
    expect(editRes.status).toBe(200);

    const resubmitRes = await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    expect(resubmitRes.status).toBe(200);
    expect(resubmitRes.body.data.verification_status).toBe('PENDING');
    // The stale note must not survive a resubmission.
    expect(resubmitRes.body.data.review_note).toBeNull();
  });

  test('NEEDS_CHANGES can only be set on a PENDING application', async () => {
    const applicant = await registerApplicant('invalidtransition');
    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'Invalid Transition Co' });
    const partnerId = createRes.body.data.id;

    // Still DRAFT — never submitted.
    const res = await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'NEEDS_CHANGES', reviewNote: 'x' });
    expect(res.status).toBe(409);
  });

  test('a user cannot start a second application while one is already in progress', async () => {
    const applicant = await registerApplicant('duplicate');
    const first = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'First Attempt Co' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'Second Attempt Co' });
    expect(second.status).toBe(409);
  });

  test("security: a user cannot view or edit another user's application", async () => {
    const owner = await registerApplicant('owner');
    const stranger = await registerApplicant('stranger');

    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ displayName: 'Private Co' });
    const partnerId = createRes.body.data.id;

    const getRes = await request(app)
      .get(`/api/v1/partners/applications/${partnerId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(getRes.status).toBe(404);

    const editRes = await request(app)
      .patch(`/api/v1/partners/applications/${partnerId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .send({ displayName: 'Hijacked' });
    expect(editRes.status).toBe(404);

    const submitRes = await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${stranger.accessToken}`);
    expect(submitRes.status).toBe(404);
  });

  test('security: a non-admin cannot approve/reject/request-changes on any application, even their own', async () => {
    const applicant = await registerApplicant('selfapprove');
    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({
        displayName: 'Self Approve Co',
        legalName: 'Self Approve Co LLC',
        email: 'contact@selfapprove.example',
        phone: '+37400000005',
      });
    const partnerId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);

    const res = await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  test('GET /partners/mine (RequirePartner-gating, approved-only) excludes an in-progress application; GET /partners/applications (unfiltered) includes it', async () => {
    const applicant = await registerApplicant('minelist');
    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({ displayName: 'Mine List Co' });
    const partnerId = createRes.body.data.id;

    // Real fix: an unapproved DRAFT application must never grant real
    // partner-dashboard capabilities just because a partner_employees
    // OWNER row already exists for it — GET /partners/mine feeds
    // AuthContext's partnerships array, which RequirePartner gates the
    // entire /partner/* dashboard on.
    const mineRes = await request(app)
      .get('/api/v1/partners/mine')
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    expect(mineRes.status).toBe(200);
    expect(mineRes.body.data.some((m) => m.partner_id === partnerId)).toBe(
      false,
    );

    const applicationsRes = await request(app)
      .get('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    expect(applicationsRes.status).toBe(200);
    const mine = applicationsRes.body.data.find(
      (m) => m.partner_id === partnerId,
    );
    expect(mine).toBeDefined();
    expect(mine.role).toBe('OWNER');
    expect(mine.verification_status).toBe('DRAFT');
  });

  test('GET /partners/mine includes a partnership once its application is approved', async () => {
    const applicant = await registerApplicant('mineapproved');
    const createRes = await request(app)
      .post('/api/v1/partners/applications')
      .set('Authorization', `Bearer ${applicant.accessToken}`)
      .send({
        displayName: 'Mine Approved Co',
        legalName: 'Mine Approved Co LLC',
        email: 'contact@mineapproved.example',
        phone: '+37400000006',
      });
    const partnerId = createRes.body.data.id;
    await request(app)
      .post(`/api/v1/partners/applications/${partnerId}/submit`)
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    await request(app)
      .patch(`/api/v1/partners/admin/${partnerId}/verification-status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'APPROVED' });

    const mineRes = await request(app)
      .get('/api/v1/partners/mine')
      .set('Authorization', `Bearer ${applicant.accessToken}`);
    expect(mineRes.body.data.some((m) => m.partner_id === partnerId)).toBe(
      true,
    );
  });
});
