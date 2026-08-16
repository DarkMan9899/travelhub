import { usePartnerContext } from '../../../contexts/PartnerContext.jsx';
import { roleHasCapability } from '../utils/partnerCapabilities.js';

/**
 * @param {string} capability - one of `PARTNER_CAPABILITIES`.
 * @returns {boolean} whether the active partnership's role grants it.
 */
export function usePartnerCapability(capability) {
  const { activePartner } = usePartnerContext();
  return roleHasCapability(activePartner?.role, capability);
}

export default usePartnerCapability;
