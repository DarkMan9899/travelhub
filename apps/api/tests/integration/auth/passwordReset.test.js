/**
 * Password-reset lifecycle (test-readiness remediation, 2026, P1 launch
 * blocker from the marketplace audit) — full HTTP round trip through the
 * real Express app: request -> real single-use hashed token -> confirm ->
 * login with the new password -> old sessions revoked.
 *
 * Mocks `ConsoleEmailProvider` (the actual, unmocked send path — this app
 * never had a real provider configured in test) to capture the raw
 * reset-link token, which the API deliberately never returns in any HTTP
 * response (account-enumeration/security requirement — see
 * `authenticationService.js#requestPasswordReset`'s own comment). This is
 * the same "mock only at a real infrastructure boundary, never the
 * application logic itself" rule `stripeManualCaptureFlow.test.js`
 * already established for this codebase — `ConsoleEmailProvider.send()`
 * IS that boundary here, exactly as `global.fetch` was there.
 *
 * Static imports are deliberately avoided in favor of `beforeAll`'s
 * dynamic-import-after-mock pattern (`paymentsDisabledGate.test.js`'s
 * established convention) — `jest.unstable_mockModule` only affects
 * imports that happen AFTER it registers, and `app.js`'s dependency graph
 * transitively imports `consoleEmailProvider.js` at module-evaluation
 * time.
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeAll,
  afterAll,
} from '@jest/globals';
import request from 'supertest';

const CONSOLE_EMAIL_PROVIDER_PATH =
  '../../../src/modules/notifications/channels/consoleEmailProvider.js';

let app;
let up;
let seedAll;
let getMysqlPool;
let closeMysqlPool;
let closeRedisConnection;
let resetRateLimits;

const sentEmails = [];

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
}

/** Extracts the raw token from the reset URL embedded in the captured email body. */
function extractTokenFromLastEmail() {
  const last = sentEmails.at(-1);
  const match = last.body.match(/reset-password\/([a-f0-9]{64})/);
  return match?.[1];
}

beforeAll(async () => {
  jest.unstable_mockModule(CONSOLE_EMAIL_PROVIDER_PATH, () => ({
    ConsoleEmailProvider: class CapturingEmailProvider {
      // eslint-disable-next-line class-methods-use-this -- matches the real ConsoleEmailProvider's shape
      async send({ subject, body }, recipientEmail) {
        sentEmails.push({ subject, body, recipientEmail });
        return { delivered: true, provider: 'console' };
      }
    },
  }));

  ({ up } = await import('../../../src/infrastructure/database/migrate.js'));
  ({ seedAll } =
    await import('../../../src/infrastructure/database/seeds/index.js'));
  ({ default: app } = await import('../../../src/app.js'));
  ({ getMysqlPool, closeMysqlPool } =
    await import('../../../src/infrastructure/database/mysqlPool.js'));
  ({ closeRedisConnection } =
    await import('../../../src/infrastructure/cache/redisClient.js'));
  ({ resetRateLimits } = await import('../helpers/resetRateLimits.js'));

  await up();
  await seedAll();
  await resetRateLimits();
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('Password reset: request -> confirm -> login with the new password', () => {
  const email = uniqueEmail('password-reset');
  const originalPassword = 'OriginalStrongPass!2024';
  const newPassword = 'BrandNewStrongPass!2025';
  let oldRefreshToken;

  test('setup: register the account and capture its initial refresh token', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email,
      password: originalPassword,
      firstName: 'Reset',
      lastName: 'Fixture',
    });
    expect(res.status).toBe(201);
    oldRefreshToken = res.body.data.refresh_token;
  });

  test('POST /auth/password-reset/request for an existing email returns a generic 200 and sends exactly one email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email, locale: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toEqual(expect.any(String));
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipientEmail).toBe(email);
    expect(sentEmails[0].body).toContain('reset-password/');
  });

  test('POST /auth/password-reset/request for an email that does not exist returns the SAME response shape/status and sends no email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: uniqueEmail('does-not-exist'), locale: 'en' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toBe(
      (
        await request(app)
          .post('/api/v1/auth/password-reset/request')
          .send({ email, locale: 'en' })
      ).body.data.message,
    );
    // Two real sends now (the setup one above, plus this re-request for
    // the real `email` just above) — none for the nonexistent address.
    expect(sentEmails.filter((e) => e.recipientEmail === email)).toHaveLength(
      2,
    );
  });

  test('the reset token is stored hashed, never in plaintext', async () => {
    const rawToken = extractTokenFromLastEmail();
    expect(rawToken).toEqual(expect.any(String));

    const pool = getMysqlPool();
    const [rows] = await pool.query(
      'SELECT token_hash FROM password_reset_tokens WHERE token_hash <> ? ORDER BY id DESC LIMIT 1',
      [rawToken],
    );
    // The raw token itself must never appear as a stored token_hash.
    expect(rows[0].token_hash).not.toBe(rawToken);
    expect(rows[0].token_hash).toHaveLength(64);
  });

  test('POST /auth/password-reset/confirm with a garbage token is rejected with 404 RESET_TOKEN_INVALID', async () => {
    const res = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: 'not-a-real-token', newPassword });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  test('POST /auth/password-reset/confirm rejects a weak new password with 422, before consuming the token', async () => {
    const rawToken = extractTokenFromLastEmail();
    const res = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'weak' });
    expect(res.status).toBe(422);
  });

  test('POST /auth/password-reset/confirm with the real token and a strong password succeeds', async () => {
    const rawToken = extractTokenFromLastEmail();
    const res = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword });
    expect(res.status).toBe(200);
    expect(res.body.data.reset).toBe(true);
  });

  test('the token is single-use: presenting it again is rejected with 404 RESET_TOKEN_INVALID', async () => {
    const rawToken = extractTokenFromLastEmail();
    const res = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'AnotherStrongPass!2026' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RESET_TOKEN_INVALID');
  });

  test('the old password no longer works', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: originalPassword });
    expect(res.status).toBe(401);
  });

  test('the new password logs in successfully', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: newPassword });
    expect(res.status).toBe(200);
    expect(res.body.data.access_token).toEqual(expect.any(String));
  });

  test('every session that existed before the reset is revoked — the pre-reset refresh token no longer works', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: oldRefreshToken });
    expect(res.status).toBe(401);
  });
});

describe('Password reset: expired token', () => {
  const email = uniqueEmail('password-reset-expired');
  const password = 'OriginalStrongPass!2024';

  test('an expired token is rejected with 409 RESET_TOKEN_EXPIRED, distinctly from an invalid one', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      firstName: 'Expired',
      lastName: 'Fixture',
    });
    await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email, locale: 'en' });
    const rawToken = extractTokenFromLastEmail();

    const pool = getMysqlPool();
    await pool.query(
      'UPDATE password_reset_tokens SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 HOUR) WHERE token_hash = SHA2(?, 256)',
      [rawToken],
    );

    const res = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: rawToken, newPassword: 'SomeStrongPass!2027' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('RESET_TOKEN_EXPIRED');
  });
});

describe('Password reset: a fresh request supersedes an earlier unused one', () => {
  const email = uniqueEmail('password-reset-supersede');
  const password = 'OriginalStrongPass!2024';

  test('the first requested token stops working once a second request is made', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email,
      password,
      firstName: 'Supersede',
      lastName: 'Fixture',
    });

    await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email, locale: 'en' });
    const firstToken = extractTokenFromLastEmail();

    await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email, locale: 'en' });
    const secondToken = extractTokenFromLastEmail();
    expect(secondToken).not.toBe(firstToken);

    const staleAttempt = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: firstToken, newPassword: 'SomeStrongPass!2028' });
    expect(staleAttempt.status).toBe(404);

    const freshAttempt = await request(app)
      .post('/api/v1/auth/password-reset/confirm')
      .send({ token: secondToken, newPassword: 'SomeStrongPass!2028' });
    expect(freshAttempt.status).toBe(200);
  });
});
