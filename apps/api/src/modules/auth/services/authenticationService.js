/**
 * AuthenticationService — public Service for the Auth module.
 *
 * Implements `API_SPECIFICATION.md` §4-7, §27 and Module Catalog #2.
 * Depends on the **Users module's public `UserService`** for account
 * lookup/creation — never a `users` Repository directly
 * (`BACKEND_ARCHITECTURE.md` §4's cross-module rule) — plus its own
 * `refresh_tokens`/`login_history` Repositories, the shared
 * `core/domain/tokenService.js` (Sprint 1, reused unchanged),
 * `passwordHasher.js`, the internal `LoginAttemptTracker`, and the
 * shared `AuditLogger`/`PermissionResolver`.
 */

import { randomUUID, createHash } from 'node:crypto';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  decodeToken,
} from '../../../core/domain/tokenService.js';
import {
  hashPassword,
  verifyPassword,
} from '../../../core/domain/passwordHasher.js';
import {
  AuthenticationError,
  AuthorizationError,
  LockedError,
} from '../../../errors/AppError.js';

const BLOCKING_STATUS_CODES = new Set(['SUSPENDED', 'BANNED']);
const DEFAULT_ROLE_CODE = 'CUSTOMER';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthenticationService {
  #userService;

  #refreshTokenRepository;

  #loginHistoryRepository;

  #loginAttemptTracker;

  #permissionResolver;

  #auditLogger;

  constructor({
    userService,
    refreshTokenRepository,
    loginHistoryRepository,
    loginAttemptTracker,
    permissionResolver,
    auditLogger,
  }) {
    this.#userService = userService;
    this.#refreshTokenRepository = refreshTokenRepository;
    this.#loginHistoryRepository = loginHistoryRepository;
    this.#loginAttemptTracker = loginAttemptTracker;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
  }

  async #issueTokenPair(user, familyId, deviceLabel) {
    const roles = await this.#userService.getRoleCodes(user.id);
    const accessToken = signAccessToken({
      sub: user.id,
      roles,
      partnerId: null,
    });
    const refreshToken = signRefreshToken({
      sub: user.id,
      familyId,
      jti: randomUUID(),
    });
    const { exp } = decodeToken(refreshToken);

    await this.#refreshTokenRepository.create({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      deviceLabel,
      expiresAt: new Date(exp * 1000),
    });

    return { accessToken, refreshToken, roles };
  }

  /**
   * @param {object} input
   * @param {object} [context] - { ipAddress, userAgent }
   */
  async register(input, context = {}) {
    const passwordHash = await hashPassword(input.password);
    const user = await this.#userService.createUser({
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone ?? null,
    });

    // Every new account gets the default global role (Sprint 6's
    // Architecture Decisions: "Host" is a partner-scoped role, never
    // granted at registration — only CUSTOMER is a registration default).
    await this.#userService.assignRole(user.id, DEFAULT_ROLE_CODE);

    const familyId = randomUUID();
    const tokens = await this.#issueTokenPair(
      user,
      familyId,
      context.deviceLabel,
    );

    await this.#auditLogger.record({
      actorId: user.id,
      action: 'user.registered',
      targetType: 'user',
      targetId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return { user, ...tokens };
  }

  /**
   * @param {{ email: string, password: string }} input
   * @param {object} [context] - { ipAddress, userAgent, deviceLabel, requestId }
   */
  async login({ email, password }, context = {}) {
    const normalizedEmail = email.trim().toLowerCase();

    if (await this.#loginAttemptTracker.isLocked(normalizedEmail)) {
      throw new LockedError();
    }

    const user = await this.#userService.findByNormalizedEmail(normalizedEmail);

    if (!user) {
      await this.#loginHistoryRepository.record({
        userId: null,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: false,
      });
      await this.#loginAttemptTracker.recordFailure(normalizedEmail);
      throw new AuthenticationError(
        'Invalid email or password.',
        'INVALID_CREDENTIALS',
      );
    }

    if (BLOCKING_STATUS_CODES.has(user.statusCode)) {
      await this.#loginHistoryRepository.record({
        userId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: false,
      });
      throw new AuthorizationError(
        'Your account has been suspended.',
        'ACCOUNT_SUSPENDED',
      );
    }

    const isPasswordValid = await verifyPassword(user.passwordHash, password);
    if (!isPasswordValid) {
      await this.#loginHistoryRepository.record({
        userId: user.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        success: false,
      });
      await this.#loginAttemptTracker.recordFailure(normalizedEmail);
      throw new AuthenticationError(
        'Invalid email or password.',
        'INVALID_CREDENTIALS',
      );
    }

    await this.#loginAttemptTracker.reset(normalizedEmail);
    await this.#loginHistoryRepository.record({
      userId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success: true,
    });
    await this.#userService.recordLogin(user.id);

    const familyId = randomUUID();
    const tokens = await this.#issueTokenPair(
      user,
      familyId,
      context.deviceLabel,
    );

    await this.#auditLogger.record({
      actorId: user.id,
      action: 'user.logged_in',
      targetType: 'user',
      targetId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return { user, ...tokens };
  }

  /**
   * Implements `API_SPECIFICATION.md` §7's strict single-use rotation
   * with reuse detection: presenting an already-rotated (revoked) token
   * revokes its entire family and forces full re-authentication.
   */
  async refresh(refreshToken, context = {}) {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const record =
      await this.#refreshTokenRepository.findByTokenHash(tokenHash);

    if (!record) {
      throw new AuthenticationError(
        'The refresh token is invalid or has expired.',
        'INVALID_REFRESH_TOKEN',
      );
    }

    if (record.revokedAt) {
      await this.#refreshTokenRepository.revokeFamily(record.familyId);
      await this.#auditLogger.record({
        actorId: record.userId,
        action: 'auth.refresh_token_reuse_detected',
        targetType: 'user',
        targetId: record.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      });
      throw new AuthenticationError(
        'This refresh token has already been used. All sessions have been revoked for security.',
        'AUTH_TOKEN_REUSE_DETECTED',
      );
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new AuthenticationError(
        'The refresh token is invalid or has expired.',
        'INVALID_REFRESH_TOKEN',
      );
    }

    const user = await this.#userService.findById(record.userId ?? payload.sub);
    if (!user || BLOCKING_STATUS_CODES.has(user.statusCode)) {
      throw new AuthenticationError(
        'The refresh token is invalid or has expired.',
        'INVALID_REFRESH_TOKEN',
      );
    }

    const tokens = await this.#issueTokenPair(
      user,
      record.familyId,
      record.deviceLabel,
    );
    const newRecord = await this.#refreshTokenRepository.findByTokenHash(
      hashToken(tokens.refreshToken),
    );
    await this.#refreshTokenRepository.revoke(record.id, newRecord?.id ?? null);

    return { user, ...tokens };
  }

  /** Revokes the single device's refresh token — idempotent. */
  async logout(refreshToken, context = {}) {
    if (refreshToken) {
      const record = await this.#refreshTokenRepository.findByTokenHash(
        hashToken(refreshToken),
      );
      if (record && !record.revokedAt) {
        await this.#refreshTokenRepository.revoke(record.id);
        await this.#auditLogger.record({
          actorId: record.userId,
          action: 'user.logged_out',
          targetType: 'user',
          targetId: record.userId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestId: context.requestId,
        });
      }
    }
    return { revoked: true };
  }

  /** Revokes every refresh token for the account — "log out of all devices." */
  async logoutAll(userId, context = {}) {
    const revokedCount =
      await this.#refreshTokenRepository.revokeAllForUser(userId);
    await this.#auditLogger.record({
      actorId: userId,
      action: 'user.logged_out_all',
      targetType: 'user',
      targetId: userId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });
    return { revokedCount };
  }

  /** GET /auth/me — the canonical "hydrate session state" endpoint. */
  async getPrincipal(userId) {
    const user = await this.#userService.findById(userId);
    if (!user) {
      throw new AuthenticationError();
    }
    const roles = await this.#userService.getRoleCodes(userId);
    const permissions =
      await this.#permissionResolver.resolvePermissions(roles);
    return { user, roles, permissions: [...permissions] };
  }
}

export default AuthenticationService;
