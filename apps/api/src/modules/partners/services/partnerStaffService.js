/**
 * PartnerStaffService — P1.4 (Master Roadmap): staff list, invite-by-email,
 * pending invitations, accept-invitation, role changes, and revocation for
 * an existing partner org's `partner_employees` roster.
 *
 * A separate Service (not folded into `partnerService.js`, already large)
 * over its own repository (`mysqlPartnerStaffRepository.js`) — same
 * multi-service-per-module shape the `notifications` module already uses
 * (`NotificationService`/`NotificationPreferenceService`/
 * `NotificationDeliveryService`).
 *
 * No prior invitation/token-with-expiry pattern exists anywhere in this
 * codebase to reuse — the closest precedent is the refresh-token idiom in
 * `authenticationService.js` (hash-only storage via SHA-256, an expiry
 * column, single-use). That idiom is adapted here, not literally reused
 * (it's a session token, this is an invitation token).
 */

import { randomBytes, createHash } from 'node:crypto';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  AuthorizationError,
} from '../../../errors/AppError.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';
import { withTransaction } from '../../../infrastructure/database/transaction.js';
import {
  assertPartnerCapability,
  assertIsPartnerMember,
} from '../authorization/partnerAuthorization.js';
import { PARTNER_CAPABILITIES } from '../../../core/domain/partnerCapabilities.js';
import { renderEmail } from '../../notifications/channels/emailTemplates.js';
import config from '../../../config/index.js';

// A role a caller may INVITE/ASSIGN via this service. OWNER is
// deliberately excluded — it is set once at partner-creation time
// (`mysqlPartnerRepository.js#createApplication`) and this module has no
// ownership-transfer flow.
const ASSIGNABLE_ROLE_CODES = [
  'MANAGER',
  'BOOKING_MANAGER',
  'EDITOR',
  'ANALYTICS_VIEWER',
];

const INVITATION_EXPIRY_DAYS = 7;

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

export class PartnerStaffService {
  #staffRepository;

  #partnerRepository;

  #userService;

  #auditLogger;

  #eventBus;

  #emailAdapter;

  constructor({
    staffRepository,
    partnerRepository,
    userService,
    auditLogger,
    eventBus = createNoOpEventBus(),
    emailAdapter,
  }) {
    this.#staffRepository = staffRepository;
    this.#partnerRepository = partnerRepository;
    this.#userService = userService;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
    this.#emailAdapter = emailAdapter;
  }

  async #getPartnerOrThrow(partnerId) {
    const partner = await this.#partnerRepository.findByIdAdmin(partnerId);
    if (!partner) throw new NotFoundError('Partner not found.');
    return partner;
  }

  /** Any active staff member may see who else is on the team. */
  async listStaff(principal, partnerId) {
    await assertIsPartnerMember(principal, partnerId);
    return this.#staffRepository.listActiveStaff(partnerId);
  }

  /** Pending invitations reveal an invitee's email — kept to `MANAGE_STAFF` only, unlike the staff list above. */
  async listInvitations(principal, partnerId) {
    await assertPartnerCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.MANAGE_STAFF,
    );
    return this.#staffRepository.listPendingInvitations(partnerId);
  }

  /**
   * Creates (or, if one is already pending for this exact email, replaces)
   * an invitation and emails it directly — bypassing the notification
   * event pipeline, since the invitee may not have a `users` row (and
   * therefore no `recipientUserId`) yet. `locale` selects which of the
   * template's EN/HY/RU renderings the email uses, same explicit-locale
   * convention `updateProfileSchema` already established for P1.3 (there
   * is no recipient `preferred_language_id` to resolve here).
   */
  async inviteStaff(principal, partnerId, { email, roleCode, locale }) {
    await assertPartnerCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.MANAGE_STAFF,
    );
    if (!ASSIGNABLE_ROLE_CODES.includes(roleCode)) {
      throw new ValidationError('Invalid role.', [
        { field: 'roleCode', issue: 'INVALID' },
      ]);
    }
    const partner = await this.#getPartnerOrThrow(partnerId);
    const roleId = await this.#staffRepository.findRoleIdByCode(roleCode);
    if (!roleId) {
      throw new ValidationError('Invalid role.', [
        { field: 'roleCode', issue: 'INVALID' },
      ]);
    }

    const trimmedEmail = email.trim();
    const normalizedEmailValue = normalizeEmail(trimmedEmail);

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await withTransaction(async (connection) => {
      // A resend simply supersedes the previous link rather than 409ing
      // on `uq_partner_employee_invitations_pending`.
      await this.#staffRepository.revokeAllPendingForEmail(
        partnerId,
        normalizedEmailValue,
        connection,
      );
      return this.#staffRepository.createInvitation(
        {
          partnerId,
          email: trimmedEmail,
          normalizedEmail: normalizedEmailValue,
          roleId,
          tokenHash: hashToken(rawToken),
          invitedByUserId: principal.userId,
          expiresAt,
        },
        connection,
      );
    });

    const inviteUrl = `${config.webAppUrl}/${locale}/partner/invitations/${rawToken}`;
    const { subject, body } = renderEmail(
      'partner.staff_invited',
      {
        partnerName: partner.displayName,
        roleName: invitation.roleName,
        inviteUrl,
      },
      locale,
    );
    await this.#emailAdapter.send({ subject, body }, trimmedEmail);

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.staff_invited',
      targetType: 'partner',
      targetId: partnerId,
      afterSnapshot: { email: trimmedEmail, roleCode },
    });

    // The raw token/link is returned exactly once, here — the same
    // "shown once at creation" convention as an API key — so a caller
    // has a "copy invite link" fallback even when the console email
    // provider (dev default) only logs the send rather than delivering
    // it anywhere the invitee can click.
    return { ...invitation, inviteUrl };
  }

  async revokeInvitation(principal, partnerId, invitationId) {
    await assertPartnerCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.MANAGE_STAFF,
    );
    const invitation = await this.#staffRepository.findPendingInvitationById(
      partnerId,
      invitationId,
    );
    if (!invitation) throw new NotFoundError('Invitation not found.');

    await this.#staffRepository.revokeInvitation(invitationId);

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.staff_invitation_revoked',
      targetType: 'partner',
      targetId: partnerId,
      afterSnapshot: { invitationId, email: invitation.email },
    });
  }

  async updateStaffRole(principal, partnerId, employeeId, roleCode) {
    await assertPartnerCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.MANAGE_STAFF,
    );
    if (!ASSIGNABLE_ROLE_CODES.includes(roleCode)) {
      throw new ValidationError('Invalid role.', [
        { field: 'roleCode', issue: 'INVALID' },
      ]);
    }
    const staff = await this.#staffRepository.findActiveStaffById(
      partnerId,
      employeeId,
    );
    if (!staff) throw new NotFoundError('Staff member not found.');
    if (staff.roleCode === 'OWNER') {
      // Never reachable via the normal UI (the owner never appears as an
      // editable row there), but still enforced server-side — this
      // endpoint has no ownership-transfer semantics.
      throw new AuthorizationError("The owner's role cannot be changed here.");
    }

    const roleId = await this.#staffRepository.findRoleIdByCode(roleCode);
    if (!roleId) {
      throw new ValidationError('Invalid role.', [
        { field: 'roleCode', issue: 'INVALID' },
      ]);
    }

    await this.#staffRepository.updateStaffRole(
      employeeId,
      roleId,
      principal.userId,
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.staff_role_changed',
      targetType: 'partner',
      targetId: partnerId,
      beforeSnapshot: { employeeId, roleCode: staff.roleCode },
      afterSnapshot: { employeeId, roleCode },
    });

    return this.#staffRepository.findActiveStaffById(partnerId, employeeId);
  }

  async removeStaff(principal, partnerId, employeeId) {
    await assertPartnerCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.MANAGE_STAFF,
    );
    const staff = await this.#staffRepository.findActiveStaffById(
      partnerId,
      employeeId,
    );
    if (!staff) throw new NotFoundError('Staff member not found.');
    if (staff.roleCode === 'OWNER') {
      throw new AuthorizationError('The owner cannot be removed.');
    }

    await this.#staffRepository.removeStaff(employeeId, principal.userId);

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.staff_removed',
      targetType: 'partner',
      targetId: partnerId,
      beforeSnapshot: {
        employeeId,
        userId: staff.userId,
        roleCode: staff.roleCode,
      },
    });
  }

  /**
   * Unauthenticated preview of an invitation, by raw token — lets the
   * frontend show "You've been invited to join X as a Y" and prompt
   * login/registration BEFORE the visitor has signed in, the same way a
   * magic link's landing page would. Possession of the raw token is
   * itself the proof of authorization to see this much; no `principal`
   * is required or used.
   */
  async previewInvitation(token) {
    const invitation =
      await this.#staffRepository.findPendingInvitationByTokenHash(
        hashToken(token),
      );
    if (!invitation) throw new NotFoundError('Invitation not found.');
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ConflictError(
        'This invitation has expired. Ask the company to send a new one.',
        'INVITATION_EXPIRED',
      );
    }
    const partner = await this.#getPartnerOrThrow(invitation.partnerId);
    return {
      partnerName: partner.displayName,
      roleName: invitation.roleName,
      email: invitation.email,
    };
  }

  /**
   * Requires the CURRENT authenticated user's own email to match the
   * invited email (case-insensitively) — the one real security check
   * this whole flow rests on. Works identically whether that user
   * already existed when the invitation was sent or only just registered
   * with the invited address.
   */
  async acceptInvitation(principal, token) {
    const invitation =
      await this.#staffRepository.findPendingInvitationByTokenHash(
        hashToken(token),
      );
    if (!invitation) throw new NotFoundError('Invitation not found.');
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new ConflictError(
        'This invitation has expired. Ask the company to send a new one.',
        'INVITATION_EXPIRED',
      );
    }

    const user = await this.#userService.findById(principal.userId);
    if (
      !user ||
      normalizeEmail(user.email) !== normalizeEmail(invitation.email)
    ) {
      throw new AuthorizationError(
        'Log in with the email address this invitation was sent to.',
      );
    }

    const partner = await this.#getPartnerOrThrow(invitation.partnerId);

    const staff = await withTransaction(async (connection) => {
      const created = await this.#staffRepository.insertStaff(
        {
          partnerId: invitation.partnerId,
          userId: principal.userId,
          roleId: invitation.roleId,
          createdByUserId: principal.userId,
        },
        connection,
      );
      await this.#staffRepository.markInvitationAccepted(
        invitation.id,
        principal.userId,
        connection,
      );
      return created;
    });

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'partner.staff_invitation_accepted',
      targetType: 'partner',
      targetId: invitation.partnerId,
      afterSnapshot: { employeeId: staff.id, roleCode: staff.roleCode },
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.PARTNER_STAFF_ADDED,
        actorId: principal.userId,
        resourceType: 'partner',
        resourceId: invitation.partnerId,
        payload: {
          partnerId: invitation.partnerId,
          partnerName: partner.displayName,
          roleName: staff.roleName,
          newEmployeeUserId: principal.userId,
        },
      }),
    );

    return staff;
  }
}

export default PartnerStaffService;
