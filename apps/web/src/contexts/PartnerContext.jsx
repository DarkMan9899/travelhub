/**
 * PartnerContext — Phase 9 (Partner Dashboard): "which partner org am I
 * acting as" for a signed-in user. `AuthContext.partnerships` is an array
 * — a user can belong to more than one partner org (Sprint 5's
 * `partner_employees` model, one row per membership) — but nothing
 * before this phase needed to track a single *active* selection, since
 * the only prior partner-facing screen (`PartnerListingWizard`) takes the
 * whole `partnerships` array and lets its own Basic Information step pick
 * one per listing. Every Phase 9 dashboard/listings/bookings/calendar
 * page needs one consistent "current partner" instead, hence this
 * context — populated by `PartnerProvider`, mounted inside
 * `RequirePartner` (so it only exists once `partnerships.length > 0` is
 * already guaranteed).
 */

import { createContext, useContext } from 'react';

const PartnerContext = createContext(null);

export default PartnerContext;

export function usePartnerContext() {
  const context = useContext(PartnerContext);
  if (!context) {
    throw new Error('usePartnerContext must be used within a PartnerProvider.');
  }
  return context;
}
