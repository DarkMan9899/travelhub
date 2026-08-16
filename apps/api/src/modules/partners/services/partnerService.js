import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
} from '../../../errors/AppError.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

const VERIFICATION_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];
// This schema's shared `moderation_statuses` lookup has no literal
// SUSPENDED/RESTORED value — a partner's "moderation" lifecycle (as
// opposed to its "verification" lifecycle) only ever moves between
// APPROVED (visible, in good standing) and FLAGGED (hidden from the
// public Companies directory/profile — see `mysqlPartnerRepository.js`'s
// `listPublic`/`findPublicBySlug`, both scoped to `ms.code = 'APPROVED'`).
// "Suspend" sets FLAGGED; "restore" sets APPROVED back.
const MODERATION_STATUSES = ['APPROVED', 'FLAGGED'];

/**
 * PartnerService — public Service for the Partners module.
 *
 * Phase 5, minimal scope by design (see docs/plan "Phase 5 — Partner
 * Listing Creation"): this module does NOT do partner onboarding/creation
 * — every partner org today is seeded (`005_dev_accounts.js`). Its one job
 * was letting an authenticated user discover which partner org(s) they
 * belong to, so the frontend can gate/populate the listing wizard.
 *
 * Phase 10 (redesign) adds the module's first public reads: a Companies
 * directory listing and a single company's public profile.
 *
 * Phase 11 (Admin Platform) adds the module's first admin-scoped read
 * (another user's memberships, for the User Management detail page) and,
 * in a later stage, its first mutations (approve/reject/suspend/restore
 * a partner's verification status) — both gated by the injected
 * `permissionResolver`/`auditLogger`, mirroring every other module's
 * pattern rather than inventing a new one.
 */

export class PartnerService {
  #partnerRepository;

  #permissionResolver;

  #auditLogger;

  #eventBus;

  constructor({
    partnerRepository,
    permissionResolver,
    auditLogger,
    eventBus = createNoOpEventBus(),
  }) {
    this.#eventBus = eventBus;
    this.#partnerRepository = partnerRepository;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
  }

  /** No owner fallback — every caller of these Stage 11.2 admin methods is inherently acting on someone else's org. */
  async #assertAnyPermission(principal, permissionKeys) {
    const granted = await Promise.all(
      permissionKeys.map((key) =>
        this.#permissionResolver.hasPermission(principal.roles, key),
      ),
    );
    if (!granted.some(Boolean)) throw new AuthorizationError();
  }

  async #assertPermission(principal, permissionKey) {
    const granted = await this.#permissionResolver.hasPermission(
      principal.roles,
      permissionKey,
    );
    if (!granted) throw new AuthorizationError();
  }

  async getMyPartnerships(principal) {
    return this.#partnerRepository.listMembershipsForUser(principal.userId);
  }

  /**
   * Phase 13 (Notifications): recipient resolution for partner-level
   * notifications (approval status, a new review/favorite on one of
   * their listings) — called only from `notifications/events/
   * notificationListener.js`, never from an HTTP route, so no
   * permission check here (matches `UserService.listUserIdsByRole`'s
   * same reasoning).
   */
  async getOwnerUserId(partnerId) {
    return this.#partnerRepository.findOwnerUserId(partnerId);
  }

  async listPublicPartners({ cursor, limit } = {}) {
    return this.#partnerRepository.listPublic({ cursor, limit });
  }

  async getPublicPartnerBySlug(slug) {
    const partner = await this.#partnerRepository.findPublicBySlug(slug);
    if (!partner) {
      throw new NotFoundError('Company not found.');
    }
    return partner;
  }

  /**
   * Phase 11 Admin Platform: `GET /partners/by-user/:userId` — no owner
   * fallback (`user.view`, checked by the route guard) since this is
   * inherently "look up someone else's memberships."
   */
  async listMembershipsForUserAdmin(userId) {
    return this.#partnerRepository.listMembershipsForUser(userId);
  }

  /**
   * Stage 11.2: `GET /partners/admin` — every partner regardless of
   * status. Either verification or moderation permission grants read
   * access to this list (a MODERATOR who can only suspend still needs
   * to see the full roster to find who to suspend).
   */
  async listPartnersAdmin(principal, filters = {}, paginationOpts = {}) {
    await this.#assertAnyPermission(principal, [
      'partner.verify',
      'partner.moderate',
    ]);
    return this.#partnerRepository.listAdmin({ ...filters, ...paginationOpts });
  }

  /** Stage 11.2: `GET /partners/admin/:id` — same either-permission read gate as the list. */
  async getPartnerAdminDetail(principal, partnerId) {
    await this.#assertAnyPermission(principal, [
      'partner.verify',
      'partner.moderate',
    ]);
    const partner = await this.#partnerRepository.findByIdAdmin(partnerId);
    if (!partner) throw new NotFoundError('Partner not found.');
    return partner;
  }

  /**
   * Stage 11.2: `PATCH /partners/admin/:id/verification-status` —
   * approve/reject a partner's onboarding, or reset to PENDING. Requires
   * `partner.verify` outright (MODERATOR, which only has
   * `partner.moderate`, cannot make verification decisions — see
   * `004_roles_and_permissions.js`'s `ROLE_PERMISSIONS`).
   */
  async updateVerificationStatus(principal, partnerId, statusCode) {
    if (!VERIFICATION_STATUSES.includes(statusCode)) {
      throw new ValidationError('Invalid verification status.');
    }
    await this.#assertPermission(principal, 'partner.verify');

    const before = await this.#partnerRepository.findByIdAdmin(partnerId);
    if (!before) throw new NotFoundError('Partner not found.');

    const updated = await this.#partnerRepository.updateVerificationStatus(
      partnerId,
      statusCode,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.verification_status_changed',
      targetType: 'partner',
      targetId: partnerId,
      beforeSnapshot: { verificationStatusCode: before.verificationStatusCode },
      afterSnapshot: { verificationStatusCode: statusCode },
    });

    if (statusCode === 'APPROVED') {
      await this.#eventBus.publish(
        createDomainEvent({
          eventType: EVENT_TYPES.PARTNER_APPROVED,
          actorId: principal.userId,
          resourceType: 'partner',
          resourceId: partnerId,
          payload: { partnerId, partnerName: updated.displayName },
        }),
      );
    }

    return updated;
  }

  /**
   * Stage 11.2: `PATCH /partners/admin/:id/moderation-status` —
   * suspend (FLAGGED) or restore (APPROVED) an already-verified
   * partner's public visibility. Requires `partner.moderate`.
   */
  async updateModerationStatus(principal, partnerId, statusCode) {
    if (!MODERATION_STATUSES.includes(statusCode)) {
      throw new ValidationError('Invalid moderation status.');
    }
    await this.#assertPermission(principal, 'partner.moderate');

    const before = await this.#partnerRepository.findByIdAdmin(partnerId);
    if (!before) throw new NotFoundError('Partner not found.');

    const updated = await this.#partnerRepository.updateModerationStatus(
      partnerId,
      statusCode,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.moderation_status_changed',
      targetType: 'partner',
      targetId: partnerId,
      beforeSnapshot: { moderationStatusCode: before.moderationStatusCode },
      afterSnapshot: { moderationStatusCode: statusCode },
    });

    return updated;
  }
}

export default PartnerService;
