/**
 * Availability query-key factory (FRONTEND_ARCHITECTURE.md §14.1),
 * mirroring `modules/listings/constants/queryKeys.js`.
 */

const availabilityKeys = {
  all: ['availability'],
  units: (listingId) => [...availabilityKeys.all, 'units', { listingId }],
  blackouts: (listingId) => [
    ...availabilityKeys.all,
    'blackouts',
    { listingId },
  ],
  // Phase 17
  blocks: (listingId) => [...availabilityKeys.all, 'blocks', { listingId }],
  externalReservations: (listingId) => [
    ...availabilityKeys.all,
    'externalReservations',
    { listingId },
  ],
  ledger: (unitId, from, to) => [
    ...availabilityKeys.all,
    'ledger',
    { unitId, from, to },
  ],
  breakdown: (unitId, from, to) => [
    ...availabilityKeys.all,
    'breakdown',
    { unitId, from, to },
  ],
  holds: (unitId, from, to) => [
    ...availabilityKeys.all,
    'holds',
    { unitId, from, to },
  ],
  connections: (partnerId) => [
    ...availabilityKeys.all,
    'connections',
    { partnerId },
  ],
  connection: (id) => [...availabilityKeys.all, 'connection', { id }],
  connectionSyncRuns: (id) => [
    ...availabilityKeys.all,
    'connectionSyncRuns',
    { id },
  ],
  connectionConflicts: (id) => [
    ...availabilityKeys.all,
    'connectionConflicts',
    { id },
  ],
};

export default availabilityKeys;
