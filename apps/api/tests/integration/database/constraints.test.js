/**
 * Sprint 5 §17: "unique constraints" and "soft-delete behavior where
 * implemented." Proves the soft-delete-safe generated-column uniqueness
 * pattern (docs/SPRINT_5_DATABASE_FOUNDATION.md §2) and the default
 * `deleted_at IS NULL` scoping helper actually behave as documented
 * against a real MySQL instance — a unit test cannot verify a database
 * constraint.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../src/infrastructure/database/errorMapping.js';
import { scopeActive } from '../../../src/infrastructure/database/softDelete.js';
import { ConflictError } from '../../../src/errors/AppError.js';

let pool;

beforeAll(async () => {
  await up();
  await seedAll();
  pool = getMysqlPool();
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
});

async function createTestUser(connection, email) {
  const [[{ id: statusId }]] = await connection.query(
    'SELECT id FROM user_statuses WHERE code = ?',
    ['ACTIVE'],
  );
  const [result] = await connection.query(
    `INSERT INTO users (email, normalized_email, password_hash, first_name, last_name, status_id)
     VALUES (?, ?, 'x', 'Test', 'User', ?)`,
    [email, email.toLowerCase(), statusId],
  );
  return result.insertId;
}

describe('Soft-delete-safe uniqueness (users.active_normalized_email)', () => {
  const email = 'constraint-test-soft-delete@example.com';

  test('a second row with the same normalized_email is rejected while the first is active', async () => {
    await createTestUser(pool, email);
    await expect(createTestUser(pool, email)).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY',
    });
  });

  test('mapMysqlError converts that duplicate-key error into a ConflictError', async () => {
    try {
      await createTestUser(pool, email);
      throw new Error('expected the insert to fail');
    } catch (err) {
      const mapped = mapMysqlError(err);
      expect(mapped).toBeInstanceOf(ConflictError);
    }
  });

  test('after soft-deleting the first row, the same normalized_email can be reused', async () => {
    await pool.query(
      'UPDATE users SET deleted_at = UTC_TIMESTAMP(3) WHERE normalized_email = ?',
      [email.toLowerCase()],
    );
    await expect(createTestUser(pool, email)).resolves.toBeGreaterThan(0);
  });
});

describe('favorites unique customer/listing relationship (Sprint 5 §10)', () => {
  test('the same customer cannot favorite the same listing twice', async () => {
    const userId = await createTestUser(
      pool,
      'constraint-test-favorites@example.com',
    );
    const [[{ id: partnerId }]] = await pool.query(
      'SELECT id FROM partners LIMIT 1',
    );
    const [[{ id: listingTypeId }]] = await pool.query(
      'SELECT id FROM listing_types WHERE code = ?',
      ['HOTEL'],
    );
    const [[{ id: listingStatusId }]] = await pool.query(
      'SELECT id FROM listing_statuses WHERE code = ?',
      ['PUBLISHED'],
    );
    const [[{ id: moderationStatusId }]] = await pool.query(
      'SELECT id FROM moderation_statuses WHERE code = ?',
      ['APPROVED'],
    );
    const [listingResult] = await pool.query(
      `INSERT INTO listings (partner_id, listing_type_id, slug, status_id, moderation_status_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        partnerId,
        listingTypeId,
        `constraint-test-listing-${Date.now()}`,
        listingStatusId,
        moderationStatusId,
      ],
    );
    const listingId = listingResult.insertId;

    await pool.query(
      'INSERT INTO favorites (customer_user_id, listing_id) VALUES (?, ?)',
      [userId, listingId],
    );
    await expect(
      pool.query(
        'INSERT INTO favorites (customer_user_id, listing_id) VALUES (?, ?)',
        [userId, listingId],
      ),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
});

describe('Soft-delete default scoping (src/infrastructure/database/softDelete.js)', () => {
  test('scopeActive() excludes soft-deleted rows by default, includes them with includeTrashed', async () => {
    const email = 'constraint-test-scoping@example.com';
    const userId = await createTestUser(pool, email);
    await pool.query(
      'UPDATE users SET deleted_at = UTC_TIMESTAMP(3) WHERE id = ?',
      [userId],
    );

    const [activeRows] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND ${scopeActive()}`,
      [userId],
    );
    expect(activeRows).toHaveLength(0);

    const [trashedRows] = await pool.query(
      `SELECT id FROM users WHERE id = ? AND ${scopeActive('', { includeTrashed: true })}`,
      [userId],
    );
    expect(trashedRows).toHaveLength(1);
  });

  test('scopeActive() rejects a non-identifier alias (defense against misuse)', () => {
    expect(() => scopeActive('u; DROP TABLE users; --')).toThrow(TypeError);
  });
});
