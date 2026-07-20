/**
 * `PENDING_VENDOR` SLA sweep — Sprint 10.
 *
 * Auto-expires (`PENDING_VENDOR -> EXPIRED`) a booking the vendor hasn't
 * responded to within `BOOKING_PENDING_VENDOR_SLA_HOURS` (default 48h) of
 * `requested_at`, restoring the capacity its items held. Separate from
 * `modules/booking-holds/jobs/holdExpirySweep.js`'s much shorter,
 * pre-booking hold TTL — this one operates on already-created bookings.
 *
 * `sweepPendingVendorBookings` is the plain, directly-callable function
 * integration tests call directly; `registerPendingVendorSlaSweepJob`
 * wraps it as a BullMQ repeatable job, registered only from `server.js`.
 */

import { Queue, Worker } from 'bullmq';
import { createQueueConnection } from '../../../infrastructure/queue/connection.js';
import { getModuleLogger } from '../../../logging/logger.js';
import config from '../../../config/index.js';

const QUEUE_NAME = 'bookings.pending-vendor-sla-sweep';
const SWEEP_INTERVAL_MS = 15 * 60_000;
const REPEATABLE_JOB_ID = 'pending-vendor-sla-sweep';

const log = getModuleLogger('bookings');

/** @returns {Promise<number>} how many bookings were auto-expired */
export async function sweepPendingVendorBookings(bookingService) {
  return bookingService.expireStaleBookings(
    config.booking.pendingVendorSlaHours,
  );
}

/**
 * @param {object} deps
 * @param {import('../services/bookingService.js').BookingService} deps.bookingService
 * @returns {{queue: Queue, worker: Worker}}
 */
export function registerPendingVendorSlaSweepJob({ bookingService }) {
  const connection = createQueueConnection();
  const queue = new Queue(QUEUE_NAME, { connection });

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const expired = await sweepPendingVendorBookings(bookingService);
      if (expired > 0) {
        log.info({ expired }, 'Auto-expired stale PENDING_VENDOR bookings');
      }
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    log.error({ err, jobId: job?.id }, 'Pending-vendor SLA sweep run failed');
  });

  queue.add(
    'sweep',
    {},
    { repeat: { every: SWEEP_INTERVAL_MS }, jobId: REPEATABLE_JOB_ID },
  );

  return { queue, worker };
}

export default registerPendingVendorSlaSweepJob;
