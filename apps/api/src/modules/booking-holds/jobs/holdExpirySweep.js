/**
 * Reservation-hold expiry sweep — Sprint 10.
 *
 * The short-TTL (default 15 minutes, `RESERVATION_HOLD_DURATION_MINUTES`)
 * mechanism that releases a hold nobody converted into a booking in time,
 * restoring the capacity it held. This is deliberately separate from
 * `modules/bookings/jobs/pendingVendorSlaSweep.js` — that one operates on
 * already-created bookings over a much longer (hours) window; this one
 * operates on pre-booking holds over a short (minutes) window.
 *
 * `sweepExpiredHolds` is the plain, directly-callable, framework-free
 * function — integration tests call this directly rather than the
 * scheduler (fast-forward `expires_at`, call this, assert). `registerHold
 * ExpirySweepJob` wraps it as a BullMQ repeatable job; only `server.js`
 * (the "app" composition-root boundary, never `app.js`/tests) calls the
 * registration function, so no Redis-backed worker runs during the
 * supertest-driven integration suite.
 */

import { Queue, Worker } from 'bullmq';
import { createQueueConnection } from '../../../infrastructure/queue/connection.js';
import { getModuleLogger } from '../../../logging/logger.js';

const QUEUE_NAME = 'booking-holds.expiry-sweep';
const SWEEP_INTERVAL_MS = 30_000;
const REPEATABLE_JOB_ID = 'hold-expiry-sweep';

const log = getModuleLogger('booking-holds');

/** @returns {Promise<number>} how many expired hold rows were released */
export async function sweepExpiredHolds(availabilityService) {
  return availabilityService.releaseExpiredHoldsBatch();
}

/**
 * @param {object} deps
 * @param {import('../../availability/services/availabilityService.js').AvailabilityService} deps.availabilityService
 * @returns {{queue: Queue, worker: Worker}} kept open for the process
 *   lifetime; `server.js`'s shutdown handler closes them alongside the
 *   MySQL pool/Redis connection.
 */
export function registerHoldExpirySweepJob({ availabilityService }) {
  const connection = createQueueConnection();
  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const released = await sweepExpiredHolds(availabilityService);
      if (released > 0) {
        log.info({ released }, 'Released expired reservation holds');
      }
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    log.error({ err, jobId: job?.id }, 'Hold-expiry sweep run failed');
  });

  queue.add(
    'sweep',
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, jobId: REPEATABLE_JOB_ID },
  );

  return { queue, worker };
}

export default registerHoldExpirySweepJob;
