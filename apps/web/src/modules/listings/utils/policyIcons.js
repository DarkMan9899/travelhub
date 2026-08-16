/**
 * policyIcons — resolves a `category_policies`/`policy_definitions.code`
 * (stable, machine-defined — unlike amenities, every policy this app has
 * ever seeded is keyed by a real code, see `007_pricing_and_policies.js`'s
 * `POLICY_DEFINITIONS`) to a `lucide-react` icon for `PolicyList`.
 */

import {
  PawPrint,
  Cigarette,
  Baby,
  CalendarClock,
  LogIn,
  LogOut,
  FileText,
} from 'lucide-react';

const ICONS_BY_POLICY_CODE = {
  pets_allowed: PawPrint,
  smoking_allowed: Cigarette,
  children_allowed: Baby,
  cancellation_policy: CalendarClock,
  check_in_time: LogIn,
  check_out_time: LogOut,
};

export default function resolvePolicyIcon(policyCode) {
  return ICONS_BY_POLICY_CODE[policyCode] ?? FileText;
}
