/**
 * Partner staff/invitation response DTOs (P1.4, Master Roadmap).
 */

export function toStaffMemberResponse(staff) {
  return {
    id: staff.id,
    user_id: staff.userId,
    email: staff.email,
    first_name: staff.firstName,
    last_name: staff.lastName,
    role: staff.roleCode,
    role_name: staff.roleName,
    since: staff.since,
  };
}

export function toInvitationResponse(invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.roleCode,
    role_name: invitation.roleName,
    expires_at: invitation.expiresAt,
    created_at: invitation.createdAt,
    // Only present on the just-created response (`inviteStaff`) — a
    // resend-safe convenience so a caller can copy the link even if the
    // configured email provider (e.g. dev's console provider) never
    // actually delivers anywhere clickable. Never re-exposed on the list
    // endpoint (see `mysqlPartnerStaffRepository.js`'s invitation select
    // — it has no token column to leak in the first place).
    invite_url: invitation.inviteUrl,
  };
}

export function toInvitationPreviewResponse(preview) {
  return {
    partner_name: preview.partnerName,
    role_name: preview.roleName,
    email: preview.email,
  };
}
