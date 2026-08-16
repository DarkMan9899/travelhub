/**
 * Frontend mirror of the backend's Phase 17 closed vocabularies
 * (`apps/api/src/modules/availability/services/availabilityService.js`,
 * `inventoryConnectionService.js`) — i18n owns the display labels (see
 * `partner.availability.reasonCodes.*`/`sourceCodes.*` translation
 * keys), these are just the codes themselves, kept in one place so a
 * form's `<Select>` options and the backend's structural validation
 * can never silently drift apart.
 */

export const BLOCK_REASON_CODES = [
  'MAINTENANCE',
  'OWNER_USE',
  'OPERATIONAL',
  'PRIVATE_EVENT',
  'STAFF_UNAVAILABLE',
  'VEHICLE_UNAVAILABLE',
  'WEATHER',
  'OTHER',
];

export const EXTERNAL_RESERVATION_SOURCE_CODES = [
  'PHONE',
  'WALK_IN',
  'PARTNER_WEBSITE',
  'BOOKING_COM',
  'EXPEDIA',
  'AIRBNB',
  'TRAVEL_AGENCY',
  'OTHER',
];

export const CONNECTOR_TYPES = [
  'MANUAL',
  'ICAL',
  'CSV',
  'GENERIC_API',
  'GENERIC_WEBHOOK',
];

export const CONNECTION_DIRECTIONS = ['IMPORT', 'EXPORT', 'BOTH'];

export default {
  BLOCK_REASON_CODES,
  EXTERNAL_RESERVATION_SOURCE_CODES,
  CONNECTOR_TYPES,
  CONNECTION_DIRECTIONS,
};
