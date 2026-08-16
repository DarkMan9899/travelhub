/**
 * AiUsageService (Phase 15) — thin wrapper over `MySqlAiUsageRepository`.
 * `record()` is called by `AiService` after every provider call (success
 * or failure); `getAggregateStats()`/`listRecent()` back the Admin AI
 * usage dashboard (`GET /admin/ai/usage`, Stage 15.6, `ai.usage_view`).
 *
 * `getPartnerUsage` (Phase 15 "AI Polish" sprint) is the partner-scoped
 * counterpart backing `GET /ai/partner/usage` — reuses the exact same
 * repository queries and DTO shape as the admin dashboard, just scoped to
 * one partner's own `ai_usage_logs` rows. Ownership is checked the same
 * way `PartnerAiService` already gates its own listing tools: the caller
 * must be an `OWNER`-role `partner_employees` row for the requested
 * `partnerId`, never a broader permission — this is "my own org's usage,"
 * not an admin capability.
 */

import {
  AuthenticationError,
  AuthorizationError,
} from '../../../errors/AppError.js';
import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';

export class AiUsageService {
  #aiUsageRepository;

  constructor({ aiUsageRepository }) {
    this.#aiUsageRepository = aiUsageRepository;
  }

  async record(entry) {
    await this.#aiUsageRepository.record(entry);
  }

  async getAggregateStats(filters) {
    return this.#aiUsageRepository.getAggregateStats(filters);
  }

  async listRecent(filters) {
    return this.#aiUsageRepository.listRecent(filters);
  }

  async getPartnerUsage(principal, partnerId, { since } = {}) {
    if (!principal) throw new AuthenticationError();
    const isOwner = await isPartnerOwner(principal.userId, partnerId);
    if (!isOwner) throw new AuthorizationError();

    const [stats, recent] = await Promise.all([
      this.#aiUsageRepository.getAggregateStats({ since, partnerId }),
      this.#aiUsageRepository.listRecent({ limit: 50, partnerId }),
    ]);
    return { stats, recent };
  }
}

export default AiUsageService;
