/**
 * LedgerService — read-only access to `financial_ledger_entries` (Phase
 * 16 spec §12). A separate Service from `PaymentService` because it is a
 * genuinely independent read concern (Partner Earnings visibility, Admin
 * ledger inspection) that never needs transactional coupling with a
 * payment/refund write — `PaymentService` writes ledger rows directly via
 * its own injected `ledgerRepository` inside its own transactions.
 */

import {
  AuthenticationError,
  AuthorizationError,
} from '../../../errors/AppError.js';
import { isPartnerOwner } from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';

const VIEW_PERMISSION = 'payment.view';

export class LedgerService {
  #ledgerRepository;

  #permissionResolver;

  constructor({ ledgerRepository, permissionResolver }) {
    this.#ledgerRepository = ledgerRepository;
    this.#permissionResolver = permissionResolver;
  }

  async #assertOwnerOrPermission(principal, partnerId) {
    if (!principal) throw new AuthenticationError();
    const isOwner = await isPartnerOwner(principal.userId, partnerId);
    if (isOwner) return;
    const hasPermission = await this.#permissionResolver.hasPermission(
      principal.roles,
      VIEW_PERMISSION,
    );
    if (!hasPermission) throw new AuthorizationError();
  }

  /**
   * A partner's payable balance, per currency, computed fresh from the
   * ledger every time (Phase 16 spec §12: no cached balance column that
   * could drift). Owner-or-`payment.view`, same visibility rule every
   * other partner-scoped financial read in this module uses.
   */
  async getPartnerBalance(principal, partnerId) {
    await this.#assertOwnerOrPermission(principal, partnerId);
    return this.#ledgerRepository.getPartnerBalance(partnerId);
  }

  /** Platform-wide ledger inspection — Admin/Support only (`payment.view`), no owner-fallback (this is cross-partner data). */
  async listEntries(principal, filters = {}, paginationOpts = {}) {
    if (!principal) throw new AuthenticationError();
    const hasPermission = await this.#permissionResolver.hasPermission(
      principal.roles,
      VIEW_PERMISSION,
    );
    if (!hasPermission) throw new AuthorizationError();
    return this.#ledgerRepository.list(filters, paginationOpts);
  }
}

export default LedgerService;
