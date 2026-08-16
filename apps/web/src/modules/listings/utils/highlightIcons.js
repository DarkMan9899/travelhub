/**
 * highlightIcons — resolves a partner-authored `icon_code` (free text,
 * `listing_highlights.icon_code`, migration 0026) to a `lucide-react`
 * icon component. Mirrors `CategoryCard.jsx`'s `ICONS_BY_SLUG` precedent:
 * a lookup table with a generic fallback, since the taxonomy this maps
 * isn't a backend-enforced enum and a code the wizard adds later (Phase
 * 18.10's Highlights editor) must still render sensibly.
 */

import {
  Wifi,
  Waves,
  ParkingCircle,
  Coffee,
  Eye,
  PawPrint,
  Wind,
  Sun,
  Moon,
  Heart,
  Award,
  ShieldCheck,
  Clock,
  Users,
  MapPin,
  Camera,
  UtensilsCrossed,
  Car,
  Snowflake,
  Mountain,
  Plane,
  Gift,
  Star,
  Sparkles,
} from 'lucide-react';

const ICONS_BY_CODE = {
  wifi: Wifi,
  pool: Waves,
  beach: Waves,
  parking: ParkingCircle,
  breakfast: Coffee,
  coffee: Coffee,
  view: Eye,
  pets: PawPrint,
  ac: Wind,
  wind: Wind,
  sun: Sun,
  moon: Moon,
  heart: Heart,
  award: Award,
  verified: ShieldCheck,
  shield: ShieldCheck,
  clock: Clock,
  fast: Clock,
  group: Users,
  users: Users,
  location: MapPin,
  'map-pin': MapPin,
  camera: Camera,
  photo: Camera,
  food: UtensilsCrossed,
  restaurant: UtensilsCrossed,
  car: Car,
  pickup: Car,
  transfer: Car,
  snow: Snowflake,
  winter: Snowflake,
  mountain: Mountain,
  hiking: Mountain,
  flight: Plane,
  airport: Plane,
  gift: Gift,
  star: Star,
};

export default function resolveHighlightIcon(iconCode) {
  return ICONS_BY_CODE[iconCode] ?? Sparkles;
}

// `ContentStep` (Phase 18.10) needs the valid code list for its icon
// picker — de-duplicated since several codes above intentionally alias
// the same icon (e.g. `pool`/`beach` both render `Waves`).
export const HIGHLIGHT_ICON_CODES = Object.keys(ICONS_BY_CODE);
