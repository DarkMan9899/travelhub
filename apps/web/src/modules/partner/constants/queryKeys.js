/**
 * Partner query-key factory (FRONTEND_ARCHITECTURE.md §14.1), mirroring
 * `modules/listings/constants/queryKeys.js`.
 */

const partnerKeys = {
  all: ['partner'],
  mine: () => [...partnerKeys.all, 'mine'],
  // P1.3 (Master Roadmap) — `GET /partners/:id/profile`.
  profile: (id) => [...partnerKeys.all, 'profile', id],
  // P1.4 (Master Roadmap) — `GET /partners/:id/staff` and
  // `GET /partners/:id/staff/invitations`.
  staff: (id) => [...partnerKeys.all, 'staff', id],
  staffInvitations: (id) => [...partnerKeys.all, 'staff', id, 'invitations'],
  // `GET /partners/invitations/:token` — the unauthenticated preview.
  invitationPreview: (token) => [
    ...partnerKeys.all,
    'invitation-preview',
    token,
  ],
};

export default partnerKeys;
