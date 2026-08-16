/**
 * AdminService — Phase 11 Admin Platform.
 *
 * Cross-cutting admin use cases live here (dashboard aggregation, and —
 * in later Phase 11 stages — audit-log reads, system health, settings).
 * Per-entity admin actions (suspend a user, verify a partner, moderate a
 * listing) belong in their own existing modules as additive service
 * methods, never duplicated here (BACKEND_ARCHITECTURE.md §4's
 * feature-based module rule).
 */

export class AdminService {
  #adminRepository;

  constructor({ adminRepository }) {
    this.#adminRepository = adminRepository;
  }

  async getDashboardStats() {
    return this.#adminRepository.getDashboardStats();
  }
}

export default AdminService;
