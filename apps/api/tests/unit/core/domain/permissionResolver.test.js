/**
 * Sprint 6: "Permission helpers." Unit-tested with a hand-written fake
 * repository (BACKEND_ARCHITECTURE.md §55: a Service can be unit-tested
 * with an in-memory fake Repository — no real database required) — the
 * DB-backed and Redis-decorated implementations are exercised separately
 * in integration tests.
 */

import { describe, test, expect, jest } from '@jest/globals';
import { PermissionResolver } from '../../../../src/core/domain/permissionResolver.js';

function fakeRepository(rolePermissions) {
  return {
    getPermissionKeysForRoleCodes: jest.fn(async (roleCodes) => {
      const keys = new Set();
      roleCodes.forEach((code) =>
        (rolePermissions[code] || []).forEach((key) => keys.add(key)),
      );
      return [...keys];
    }),
  };
}

describe('PermissionResolver (src/core/domain/permissionResolver.js)', () => {
  test('resolvePermissions returns the union of permissions across roles as a Set', async () => {
    const repository = fakeRepository({
      CUSTOMER: [],
      MODERATOR: ['listing.moderate', 'review.moderate'],
    });
    const resolver = new PermissionResolver(repository);

    const permissions = await resolver.resolvePermissions([
      'CUSTOMER',
      'MODERATOR',
    ]);

    expect(permissions).toBeInstanceOf(Set);
    expect(permissions.has('listing.moderate')).toBe(true);
    expect(permissions.has('review.moderate')).toBe(true);
  });

  test('resolvePermissions returns an empty Set for an empty role list without calling the repository', async () => {
    const repository = fakeRepository({});
    const resolver = new PermissionResolver(repository);

    const permissions = await resolver.resolvePermissions([]);

    expect(permissions.size).toBe(0);
    expect(repository.getPermissionKeysForRoleCodes).not.toHaveBeenCalled();
  });

  test('hasPermission is true only when the resolved set contains the key', async () => {
    const repository = fakeRepository({ ADMIN: ['role.assign'] });
    const resolver = new PermissionResolver(repository);

    await expect(
      resolver.hasPermission(['ADMIN'], 'role.assign'),
    ).resolves.toBe(true);
    await expect(
      resolver.hasPermission(['ADMIN'], 'role.manage'),
    ).resolves.toBe(false);
  });
});
