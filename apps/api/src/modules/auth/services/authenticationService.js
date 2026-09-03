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

import { randomUUID, randomBytes, createHash } from 'node:crypto';
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
  ConflictError,
  NotFoundError,
  LockedError,
} from '../../../errors/AppError.js';
import { renderEmail } from '../../notifications/channels/emailTemplates.js';
import config from '../../../config/index.js';

const BLOCKING_STATUS_CODES = new Set(['SUSPENDED', 'BANNED']);
const DEFAULT_ROLE_CODE = 'CUSTOMER';
// Deliberately much shorter than the staff-invitation token's 7 days
// (`partnerStaffService.js`'s `INVITATION_EXPIRY_DAYS`) — a password
// reset is a higher-stakes credential-recovery action, so a narrower
// window that limits how long a leaked/forwarded email link stays
// dangerous is the right tradeoff here, unlike an invitation link, which
// is a lower-stakes convenience with no live-secret window to shrink.
const PASSWORD_RESET_EXPIRY_MINUTES = 60;

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

  #passwordResetTokenRepository;

  #emailAdapter;

  constructor({
    userService,
    refreshTokenRepository,
    loginHistoryRepository,
    loginAttemptTracker,
    permissionResolver,
    auditLogger,
    passwordResetTokenRepository,
    emailAdapter,
  }) {
    this.#userService = userService;
    this.#refreshTokenRepository = refreshTokenRepository;
    this.#loginHistoryRepository = loginHistoryRepository;
    this.#loginAttemptTracker = loginAttemptTracker;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
    this.#passwordResetTokenRepository = passwordResetTokenRepository;
    this.#emailAdapter = emailAdapter;
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

  /**
   * Always resolves the same way regardless of whether `email` matches a
   * real account — the controller returns one identical response either
   * way (API_SPECIFICATION-style account-enumeration avoidance: a caller
   * must not be able to tell "no such account" apart from "email sent"
   * by the response shape, status, or observable timing of THIS method
   * — real timing variance between the found/not-found branches below is
   * accepted as a known, low-value side channel here, the same tradeoff
   * every mainstream reset-flow implementation makes rather than adding
   * artificial delay). No email is sent, and nothing is written, for an
   * email that doesn't match an account — there is nothing to reset and
   * no recipient to notify.
   */
  async requestPasswordReset({ email, locale }, context = {}) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.#userService.findByNormalizedEmail(normalizedEmail);

    if (!user || BLOCKING_STATUS_CODES.has(user.statusCode)) {
      return { requested: true };
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
    );

    // A fresh request supersedes any earlier, still-unused link for this
    // account — same "resend simply supersedes the previous link" choice
    // `partnerStaffService.js#inviteStaff` already makes, for the same
    // reason: an abandoned older link should stop working once a newer
    // one exists, rather than leaving two simultaneously valid.
    await this.#passwordResetTokenRepository.invalidateAllForUser(user.id);
    await this.#passwordResetTokenRepository.create({
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt,
    });

    const resetUrl = `${config.webAppUrl}/${locale}/auth/reset-password/${rawToken}`;
    const { subject, body } = renderEmail(
      'auth.password_reset_requested',
      { resetUrl },
      locale,
    );
    // Never logged, never returned to the caller — the raw token/URL's
    // only path out of this process is this one `send()` call, unlike
    // `partnerStaffService.js#inviteStaff`'s deliberate "also return it
    // in the response" fallback, which is safe there only because that
    // endpoint is authenticated and permissioned; this one is public.
    await this.#emailAdapter.send({ subject, body }, user.email);

    await this.#auditLogger.record({
      actorId: user.id,
      action: 'auth.password_reset_requested',
      targetType: 'user',
      targetId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return { requested: true };
  }

  /**
   * Consumes a single-use reset token and sets a new password. Unlike
   * `requestPasswordReset` above, this step is safe to be specific about
   * *why* it failed (expired vs. invalid/already-used) — possession of
   * the token already proves the caller received the email, so there is
   * no account-existence signal left to protect at this step.
   */
  async resetPassword({ token, newPassword }, context = {}) {
    const record = await this.#passwordResetTokenRepository.findByTokenHash(
      hashToken(token),
    );
    if (!record || record.usedAt) {
      throw new NotFoundError(
        'This password reset link is invalid or has already been used.',
        'RESET_TOKEN_INVALID',
      );
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new ConflictError(
        'This password reset link has expired. Request a new one.',
        'RESET_TOKEN_EXPIRED',
      );
    }

    const user = await this.#userService.findById(record.userId);
    if (!user || BLOCKING_STATUS_CODES.has(user.statusCode)) {
      throw new NotFoundError(
        'This password reset link is invalid or has already been used.',
        'RESET_TOKEN_INVALID',
      );
    }

    const newPasswordHash = await hashPassword(newPassword);
    await this.#userService.setPasswordHashSystemInternal(
      user.id,
      newPasswordHash,
    );
    await this.#passwordResetTokenRepository.markUsed(record.id);
    // Defense in depth beyond the single token just consumed — an older,
    // still-unexpired reset link for the same account (e.g. one from a
    // prior request that the fresh-request supersession in
    // `requestPasswordReset` didn't reach, or a narrow race with a
    // second concurrent request) must not remain usable once the
    // password it would reset has already changed.
    await this.#passwordResetTokenRepository.invalidateAllForUser(user.id);
    // A password reset is exactly the "credential may have been
    // compromised" scenario `logoutAll` exists for — every existing
    // session is force-logged-out, same mechanism `POST /auth/logout-all`
    // already exposes to a signed-in user, applied here on the user's
    // behalf since they are, by definition, signed out during a reset.
    await this.#refreshTokenRepository.revokeAllForUser(user.id);

    await this.#auditLogger.record({
      actorId: user.id,
      action: 'auth.password_reset_completed',
      targetType: 'user',
      targetId: user.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      requestId: context.requestId,
    });

    return { reset: true };
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
