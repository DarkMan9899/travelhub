/**
 * Sprint 6: "Permission helpers" / "Roles: Customer, Host, Admin."
 * Exercises `requirePermission`/`requireHost` against real seeded data
 * (Sprint 5's `admin@travelhub.dev`/`vendor@travelhub.dev`/
 * `customer@travelhub.dev` and roles/permissions) — a unit test with a
 * fake repository (already covered in tests/unit/core/domain/
 * permissionResolver.test.js) cannot prove the real SQL joins are
 * correct; only a real database can.
 *
 * No Sprint 6 HTTP route mounts these guards yet (see
 * docs/SPRINT_6_AUTH_FOUNDATION.md's Architecture Decisions), so they
 * are exercised directly as plain middleware functions here rather than
 * through supertest — this is still a real integration test: the
 * `PermissionResolver`/`isPartnerOwner` dependencies are the actual
 * MySQL-backed implementations, not fakes.
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { PermissionResolver } from '../../../src/core/domain/permissionResolver.js';
import { MySqlPermissionRepository } from '../../../src/infrastructure/database/repositories/permissionRepository.js';
import { isPartnerOwner } from '../../../src/infrastructure/database/repositories/partnerEmployeeRepository.js';
import { createRequirePermissionGuard } from '../../../src/guards/requirePermission.js';
import { createRequireHostGuard } from '../../../src/guards/requireHost.js';

let pool;
let permissionResolver;

beforeAll(async () => {
  await up();
  await seedAll();
  pool = getMysqlPool();
  permissionResolver = new PermissionResolver(
    new MySqlPermissionRepository(pool),
  );
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

function mockRes() {
  return {};
}

describe('requirePermission (real DB-backed PermissionResolver)', () => {
  const requirePermission = createRequirePermissionGuard(permissionResolver);

  test('SUPER_ADMIN passes a check for any seeded permission', async () => {
    const req = { principal: { userId: 1, roles: ['SUPER_ADMIN'] } };
    const next = (err) => {
      expect(err).toBeUndefined();
    };
    await requirePermission('role.manage')(req, mockRes(), next);
  });

  test('CUSTOMER is rejected for an admin-only permission', async () => {
    const req = { principal: { userId: 1, roles: ['CUSTOMER'] } };
    let receivedError;
    const next = (err) => {
      receivedError = err;
    };
    await requirePermission('role.manage')(req, mockRes(), next);
    expect(receivedError).toBeDefined();
    expect(receivedError.code).toBe('FORBIDDEN');
  });

  test('MODERATOR passes listing.moderate but is rejected for role.manage', async () => {
    const req = { principal: { userId: 1, roles: ['MODERATOR'] } };

    let firstError;
    await requirePermission('listing.moderate')(req, mockRes(), (err) => {
      firstError = err;
    });
    expect(firstError).toBeUndefined();

    let secondError;
    await requirePermission('role.manage')(req, mockRes(), (err) => {
      secondError = err;
    });
    expect(secondError).toBeDefined();
  });

  test('an unauthenticated request is rejected with AuthenticationError', async () => {
    const req = {};
    let receivedError;
    await requirePermission('listing.moderate')(req, mockRes(), (err) => {
      receivedError = err;
    });
    expect(receivedError.code).toBe('UNAUTHENTICATED');
  });
});

describe('requireHost — Sprint 6\'s "Host" mapped onto partner_employees.OWNER', () => {
  const requireHost = createRequireHostGuard(isPartnerOwner);

  test('the seeded vendor (an OWNER of yerevan-boutique-hospitality) passes', async () => {
    const [[vendorRow]] = await pool.query(
      'SELECT id FROM users WHERE normalized_email = ?',
      ['vendor@travelhub.dev'],
    );
    const req = {
      principal: { userId: vendorRow.id, roles: ['CUSTOMER'] },
      params: {},
    };
    let receivedError;
    await requireHost(req, mockRes(), (err) => {
      receivedError = err;
    });
    expect(receivedError).toBeUndefined();
  });

  test('the seeded customer (not a partner OWNER) is rejected', async () => {
    const [[customerRow]] = await pool.query(
      'SELECT id FROM users WHERE normalized_email = ?',
      ['customer@travelhub.dev'],
    );
    const req = {
      principal: { userId: customerRow.id, roles: ['CUSTOMER'] },
      params: {},
    };
    let receivedError;
    await requireHost(req, mockRes(), (err) => {
      receivedError = err;
    });
    expect(receivedError).toBeDefined();
    expect(receivedError.code).toBe('FORBIDDEN');
  });
});
