/**
 * Inventory connection reconciliation sweep (Phase 17 §24-27) — a
 * scheduled pull re-sync of every active `inventory_connections` row,
 * reusing `InventoryConnectionService#syncAllActiveConnections` (the
 * exact same connector/import/conflict/event-publish code path a
 * partner's own "Sync now" button drives) so a connection stays
 * reasonably fresh between manual syncs and between-webhook gaps,
 * without needing a separate sync implementation.
 *
 * Mirrors `booking-holds/jobs/holdExpirySweep.js`'s exact shape:
 * `sweepInventoryConnections` is the plain, directly-callable,
 * framework-free function integration tests call directly;
 * `registerInventoryReconciliationSweepJob` wraps it as a BullMQ
 * repeatable job, called only from `server.js` (never `app.js`/tests),
 * so no Redis-backed worker runs during the supertest-driven
 * integration suite.
 */

import { Queue, Worker } from 'bullmq';
import { createQueueConnection } from '../../../infrastructure/queue/connection.js';
import { getModuleLogger } from '../../../logging/logger.js';

const QUEUE_NAME = 'availability.inventory-reconciliation-sweep';
// A real connector sync involves network I/O (or, for the demo/test
// ManualConnector/IcalConnector fixture path, none) — 15 minutes keeps
// this well clear of the 30-second hold-expiry sweep's cadence, matching
// "reconciliation," not "near-real-time," per spec §24.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const REPEATABLE_JOB_ID = 'inventory-reconciliation-sweep';

const log = getModuleLogger('availability');

/** @returns {Promise<Array<{connectionId:number, status:string}>>} one entry per synced connection */
export async function sweepInventoryConnections(inventoryConnectionService) {
  return inventoryConnectionService.syncAllActiveConnections({
    triggerCode: 'SCHEDULED',
  });
}

/**
 * @param {object} deps
 * @param {import('../services/inventoryConnectionService.js').InventoryConnectionService} deps.inventoryConnectionService
 * @returns {{queue: Queue, worker: Worker}} kept open for the process
 *   lifetime; `server.js`'s shutdown handler closes them alongside the
 *   MySQL pool/Redis connection.
 */
export function registerInventoryReconciliationSweepJob({
  inventoryConnectionService,
}) {
  const connection = createQueueConnection();
  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const results = await sweepInventoryConnections(
        inventoryConnectionService,
      );
      const failed = results.filter((r) => r.status === 'FAILED').length;
      if (results.length > 0) {
        log.info(
          { synced: results.length, failed },
          'Inventory reconciliation sweep completed',
        );
      }
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    log.error(
      { err, jobId: job?.id },
      'Inventory reconciliation sweep run failed',
    );
  });

  queue.add(
    'sweep',
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, jobId: REPEATABLE_JOB_ID },
  );

  return { queue, worker };
}

export default registerInventoryReconciliationSweepJob;
