/**
 * Password hashing.
 *
 * Implements `BACKEND_ARCHITECTURE.md` §12: "a modern, adaptive, salted
 * algorithm (Argon2id)... never a fast general-purpose hash." `argon2`'s
 * default `hash()` call already produces an Argon2id digest (verified:
 * the output is prefixed `$argon2id$`) — no explicit `type` option is
 * needed, and passing one would only risk drifting from the default the
 * rest of the codebase already relies on (Sprint 5's seed scripts call
 * `argon2.hash(password)` the same way, with no options).
 *
 * Domain layer (`src/core/`) — depends on nothing outside `core` plus the
 * pure `argon2` algorithm itself (no database, no Express), mirroring
 * `tokenService.js`'s precedent of importing a pure cryptographic
 * library directly inside `core/domain/`.
 */

import argon2 from 'argon2';

export async function hashPassword(plainPassword) {
  return argon2.hash(plainPassword);
}

/** Never throws on a malformed/foreign hash — always resolves to a boolean. */
export async function verifyPassword(hash, plainPassword) {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    return false;
  }
}

export default { hashPassword, verifyPassword };
