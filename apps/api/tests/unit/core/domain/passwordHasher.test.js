/**
 * Sprint 6: "Password hashing (Argon2 or the project's existing
 * standard)." Argon2's default `hash()` already produces Argon2id
 * (BACKEND_ARCHITECTURE.md §12) — verified directly here, not just
 * assumed from the doc comment in passwordHasher.js.
 */

import { describe, test, expect } from '@jest/globals';
import {
  hashPassword,
  verifyPassword,
} from '../../../../src/core/domain/passwordHasher.js';

describe('passwordHasher (src/core/domain/passwordHasher.js)', () => {
  test('hashPassword produces an Argon2id digest', async () => {
    const hash = await hashPassword('CorrectHorseBattery9!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  test('verifyPassword resolves true for the correct plaintext', async () => {
    const hash = await hashPassword('CorrectHorseBattery9!');
    await expect(verifyPassword(hash, 'CorrectHorseBattery9!')).resolves.toBe(
      true,
    );
  });

  test('verifyPassword resolves false for an incorrect plaintext', async () => {
    const hash = await hashPassword('CorrectHorseBattery9!');
    await expect(verifyPassword(hash, 'WrongPassword1!')).resolves.toBe(false);
  });

  test('verifyPassword resolves false (never throws) for a malformed hash', async () => {
    await expect(verifyPassword('not-a-real-hash', 'anything')).resolves.toBe(
      false,
    );
  });

  test('hashing the same password twice produces different digests (salted)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('SamePassword1!'),
      hashPassword('SamePassword1!'),
    ]);
    expect(a).not.toBe(b);
  });
});
