/**
 * PartnerProvider — Phase 9 (Partner Dashboard). Defaults `activePartnerId`
 * to the first entry in `AuthContext.partnerships` (already sorted by
 * `display_name` server-side, `mysqlPartnerRepository.js`'s own query) and
 * exposes a setter for the rare multi-partnership case. Mounted inside
 * `RequirePartner` in `routes/index.jsx` — never at the app root, since it
 * has nothing meaningful to hold for a non-partner visitor.
 */

import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import PartnerContext from '../contexts/PartnerContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function PartnerProvider({ children }) {
  const { partnerships } = useAuth();
  const [activePartnerId, setActivePartnerId] = useState(
    () => partnerships[0]?.partner_id ?? null,
  );

  const activePartner =
    partnerships.find((p) => p.partner_id === activePartnerId) ??
    partnerships[0] ??
    null;

  const value = useMemo(
    () => ({
      partnerships,
      activePartnerId: activePartner?.partner_id ?? null,
      activePartner,
      setActivePartnerId,
    }),
    [partnerships, activePartner],
  );

  return (
    <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>
  );
}

PartnerProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
