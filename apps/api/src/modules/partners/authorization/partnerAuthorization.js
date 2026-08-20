/**
 * Shared `partner_employees` RBAC assertions (P1.4, Master Roadmap).
 *
 * Extracted out of `partnerService.js`'s private `#assertIsMember`/
 * `#assertCanManageProfile` methods once `partnerStaffService.js` needed
 * the exact same owner-bypass + capability-check idiom a third time
 * (`inventoryConnectionService.js#assertCapability` was the first) —
 * three independent copies of the same ~10 lines is the point CLAUDE.md's
 * "never duplicate functionality" stops being a style preference and
 * starts being a real maintenance hazard (a future capability added here
 * would otherwise need to be remembered in three places).
 */

import {
  AuthenticationError,
  AuthorizationError,
} from '../../../errors/AppError.js';
import {
  isPartnerOwner,
  getPartnerEmployeeRoleCode,
} from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import { roleHasCapability } from '../../../core/domain/partnerCapabilities.js';

/** Any ACTIVE `partner_employees` row, any role — the common read gate. */
export async function assertIsPartnerMember(principal, partnerId) {
  if (!principal) throw new AuthenticationError();
  if (await isPartnerOwner(principal.userId, partnerId)) return;
  const roleCode = await getPartnerEmployeeRoleCode(
    principal.userId,
    partnerId,
  );
  if (roleCode) return;
  throw new AuthorizationError();
}

/** Owner bypass + a named `PARTNER_CAPABILITIES` entry — the common write gate. */
export async function assertPartnerCapability(
  principal,
  partnerId,
  capability,
) {
  if (!principal) throw new AuthenticationError();
  if (await isPartnerOwner(principal.userId, partnerId)) return;
  const roleCode = await getPartnerEmployeeRoleCode(
    principal.userId,
    partnerId,
  );
  if (roleHasCapability(roleCode, capability)) return;
  throw new AuthorizationError();
}
