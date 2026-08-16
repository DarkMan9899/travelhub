/**
 * Partner query-key factory (FRONTEND_ARCHITECTURE.md §14.1), mirroring
 * `modules/listings/constants/queryKeys.js`. Only one resource so far —
 * `GET /partners/mine`, this module's sole endpoint (Phase 5 scope).
 */

const partnerKeys = {
  all: ['partner'],
  mine: () => [...partnerKeys.all, 'mine'],
};

export default partnerKeys;
