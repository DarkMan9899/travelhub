/**
 * UserService — public Service for the Users module.
 *
 * Implements BACKEND_ARCHITECTURE.md §6/§13: owns all `users`-table
 * business logic. Ownership checks ("Owner or `{permission}`",
 * API_SPECIFICATION.md §5) live here, one layer below the guards, since
 * they require loading the specific resource being acted on — a guard
 * alone cannot know who owns a given `users.id` without a database read.
 *
 * Depends on `mediaConstraints.js` (Sprint 5, `modules/media/validators/`)
 * and the injected `StorageProvider`/`AuditLogger`/`PermissionResolver` —
 * concrete infrastructure is never imported here directly, only received
 * via constructor injection from `module.container.js`.
 */

import {
  AuthorizationError,
  AuthenticationError,
  ConflictError,
  ValidationError,
  NotFoundError,
} from '../../../errors/AppError.js';
import {
  hashPassword,
  verifyPassword,
} from '../../../core/domain/passwordHasher.js';
import {
  isAllowedMimeType,
  isWithinSizeLimit,
  classifyMimeType,
} from '../../media/validators/mediaConstraints.js';

export class UserService {
  #userRepository;

  #storageProvider;

  #auditLogger;

  #permissionResolver;

  constructor({
    userRepository,
    storageProvider,
    auditLogger,
    permissionResolver,
  }) {
    this.#userRepository = userRepository;
    this.#storageProvider = storageProvider;
    this.#auditLogger = auditLogger;
    this.#permissionResolver = permissionResolver;
  }

  /** "Owner or `{permissionKey}`" (API_SPECIFICATION.md §5). */
  async #assertOwnerOrPermission(principal, targetUserId, permissionKey) {
    if (principal.userId === targetUserId) return;
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      permissionKey,
    );
    if (!granted) throw new AuthorizationError();
  }

  /**
   * Used by AuthenticationService.register — Auth depends on this public
   * method, never the Users module's Repository directly.
   */
  async createUser({
    email,
    passwordHash,
    firstName,
    lastName,
    phone = null,
    preferredLanguageId = null,
    preferredCurrencyId = null,
  }) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing =
      await this.#userRepository.findByNormalizedEmail(normalizedEmail);
    if (existing) {
      throw new ConflictError(
        'An account with this email already exists.',
        'EMAIL_ALREADY_EXISTS',
      );
    }
    return this.#userRepository.create({
      email,
      normalizedEmail,
      passwordHash,
      firstName,
      lastName,
      phone,
      preferredLanguageId,
      preferredCurrencyId,
    });
  }

  async findById(id) {
    return this.#userRepository.findById(id);
  }

  async findByNormalizedEmail(normalizedEmail) {
    return this.#userRepository.findByNormalizedEmail(normalizedEmail);
  }

  /** Used by AuthenticationService to build the JWT's `roles` claim. */
  async getRoleCodes(userId) {
    return this.#userRepository.getRoleCodes(userId);
  }

  /** Used by AuthenticationService.register to grant the default global role. */
  async assignRole(userId, roleCode) {
    return this.#userRepository.assignRole(userId, roleCode);
  }

  /** Used by AuthenticationService.login on a successful attempt. */
  async recordLogin(userId) {
    return this.#userRepository.updateLastLoginAt(userId);
  }

  async updateProfile(principal, targetUserId, fields) {
    await this.#assertOwnerOrPermission(principal, targetUserId, 'user.update');

    const user = await this.#userRepository.findById(targetUserId);
    if (!user) throw new NotFoundError('User not found.');

    const updated = await this.#userRepository.updateProfile(
      targetUserId,
      fields,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'user.profile_updated',
      targetType: 'user',
      targetId: targetUserId,
      afterSnapshot: fields,
    });

    return updated;
  }

  /**
   * Owner-only, no permission fallback — API_SPECIFICATION.md §28 lists
   * this endpoint's permission as exactly "Owner", never "Owner or
   * `{permission}`". Even an admin cannot set another user's password
   * outside a proper reset flow.
   */
  async changePassword(principal, targetUserId, currentPassword, newPassword) {
    if (principal.userId !== targetUserId) {
      throw new AuthorizationError();
    }

    const user = await this.#userRepository.findById(targetUserId);
    if (!user) throw new NotFoundError('User not found.');

    const isCurrentPasswordValid = await verifyPassword(
      user.passwordHash,
      currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new AuthenticationError(
        'The current password is incorrect.',
        'INVALID_CREDENTIALS',
      );
    }

    const newPasswordHash = await hashPassword(newPassword);
    await this.#userRepository.updatePasswordHash(
      targetUserId,
      newPasswordHash,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'user.password_changed',
      targetType: 'user',
      targetId: targetUserId,
    });
  }

  /**
   * Sprint 6 §5: "Avatar field support (storage abstraction only, no
   * cloud integration)" — stores via the injected StorageProvider
   * (LocalStorageProvider in this sprint), creates the backing `media`
   * row, and points `users.avatar_media_id` at it.
   */
  async setAvatar(principal, targetUserId, buffer, mimeType) {
    await this.#assertOwnerOrPermission(principal, targetUserId, 'user.update');

    const user = await this.#userRepository.findById(targetUserId);
    if (!user) throw new NotFoundError('User not found.');

    if (
      !isAllowedMimeType(mimeType) ||
      classifyMimeType(mimeType) !== 'image'
    ) {
      throw new ValidationError('Avatar must be a JPEG, PNG, or WebP image.');
    }
    if (!isWithinSizeLimit(mimeType, buffer.length)) {
      throw new ValidationError(
        'Avatar exceeds the maximum allowed file size.',
      );
    }

    const extension = mimeType.split('/')[1];
    const key = `avatars/${targetUserId}/${Date.now()}.${extension}`;
    const { url } = await this.#storageProvider.put(key, buffer, {
      contentType: mimeType,
    });

    const mediaId = await this.#userRepository.createAvatarMedia({
      userId: targetUserId,
      url,
      mimeType,
      fileSizeBytes: buffer.length,
    });
    await this.#userRepository.updateAvatarMediaId(targetUserId, mediaId);

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'user.avatar_updated',
      targetType: 'user',
      targetId: targetUserId,
      afterSnapshot: { avatarMediaId: mediaId },
    });

    return this.#userRepository.findById(targetUserId);
  }
}

export default UserService;
