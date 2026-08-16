/**
 * amenityGroupIcons — resolves an `amenity_groups.code` (the stable
 * machine code, e.g. `CONNECTIVITY` — the group-level identifier, since
 * individual amenity rows only ever carry a free-text, already-localized
 * `name`, never a stable per-item code; see `ListingAmenitiesSection.jsx`'s
 * own header for why) to a `lucide-react` icon. Every code seeded in
 * `006_search_filters.js`'s `AMENITY_GROUPS` is covered; an unseeded
 * future group code still renders sensibly via the fallback.
 */

import {
  Sparkles as WellnessIcon,
  TreePine,
  UtensilsCrossed,
  Wifi,
  Accessibility,
  PawPrint,
  ConciergeBell,
  Soup,
  HelpCircle,
} from 'lucide-react';

const ICONS_BY_GROUP_CODE = {
  WELLNESS: WellnessIcon,
  OUTDOOR: TreePine,
  KITCHEN_LAUNDRY: UtensilsCrossed,
  CONNECTIVITY: Wifi,
  ACCESSIBILITY_SAFETY: Accessibility,
  FAMILY_PETS: PawPrint,
  FOOD_SERVICE: ConciergeBell,
  DINING: Soup,
};

export default function resolveAmenityGroupIcon(groupCode) {
  return ICONS_BY_GROUP_CODE[groupCode] ?? HelpCircle;
}
