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
  // Admin Sprint 5 — plain arrays (no `partnerId`/`connectionId` to
  // parameterize on, these are the genuinely admin-wide reads), built
  // from the literal `all` value rather than a self-reference to
  // `availabilityKeys.all` — the object literal isn't finished
  // constructing yet at this point, unlike the functions above (only
  // invoked later, once `availabilityKeys` fully exists).
  adminConnectionsOverview: ['availability', 'adminConnectionsOverview'],
  adminConflictsOverview: ['availability', 'adminConflictsOverview'],
};

export default availabilityKeys;
