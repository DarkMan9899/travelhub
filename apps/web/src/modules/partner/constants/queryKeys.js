/**
 * Partner query-key factory (FRONTEND_ARCHITECTURE.md §14.1), mirroring
 * `modules/listings/constants/queryKeys.js`.
 */

const partnerKeys = {
  all: ['partner'],
  mine: () => [...partnerKeys.all, 'mine'],
  // P1.3 (Master Roadmap) — `GET /partners/:id/profile`.
  profile: (id) => [...partnerKeys.all, 'profile', id],
};

export default partnerKeys;
