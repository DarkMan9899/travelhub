/**
 * Phase 8 (Auth / User Dashboard): unit coverage for `toUserDto`'s
 * additive `avatar_url`/`preferred_language_id`/`preferred_currency_id`
 * fields — added so `GET /auth/me`'s embedded user matches
 * `userController.js`'s own `toUserResponse` shape, letting the frontend
 * Profile page prefill entirely from `AuthContext`. Pure mapping
 * function, no database needed.
 */

import { describe, test, expect } from '@jest/globals';
import { toUserDto } from '../../../../src/modules/auth/dto/authDto.js';

describe('toUserDto', () => {
  test('includes avatar_url, preferred_language_id, and preferred_currency_id', () => {
    const dto = toUserDto({
      id: 1,
      email: 'a@example.com',
      firstName: 'A',
      lastName: 'B',
      phone: null,
      avatarMediaId: 9,
      avatarUrl: '/uploads/avatars/9/file.png',
      preferredLanguageId: 2,
      preferredCurrencyId: 1,
      isEmailVerified: true,
      isPhoneVerified: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02'),
    });

    expect(dto.avatar_url).toBe('/uploads/avatars/9/file.png');
    expect(dto.preferred_language_id).toBe(2);
    expect(dto.preferred_currency_id).toBe(1);
  });

  test('never exposes password_hash even if present on the domain object', () => {
    const dto = toUserDto({
      id: 1,
      email: 'a@example.com',
      firstName: 'A',
      lastName: 'B',
      passwordHash: 'super-secret-hash',
    });

    expect(dto.password_hash).toBeUndefined();
  });
});
