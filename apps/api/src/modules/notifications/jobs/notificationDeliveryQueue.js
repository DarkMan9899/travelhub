/**
 * Notification delivery queue — Phase 13.
 *
 * Unlike the platform's two existing queues (`booking-holds.expiry-sweep`,
 * `bookings.pending-vendor-sla-sweep`), which are repeatable sweeps with
 * no job payload, this is a per-job queue: one job per (notificationId,
 * channel) pair, added on demand by `NotificationDeliveryService.dispatch`
 * so a channel send never happens inline in the HTTP request that
 * triggered the underlying domain event.
 *
 * `enqueueDelivery` is the plain, directly-callable function
 * `NotificationDeliveryService` is injected with (so it never imports
 * BullMQ directly). `registerNotificationDeliveryWorker` wraps the
 * processing side as a BullMQ Worker; only `server.js` calls it — same
 * "never in app.js/tests" rule the two existing job files already follow,
 * so importing `app.js` for the supertest-driven integration suite never
 * starts a Redis-backed worker as a side effect.
 */

import { Queue, Worker } from 'bullmq';
import { createQueueConnection } from '../../../infrastructure/queue/connection.js';
import { getModuleLogger } from '../../../logging/logger.js';

export const NOTIFICATION_DELIVERY_QUEUE_NAME = 'notifications.delivery';

// P0.4 (Master Roadmap): this queue previously had no retry configured at
// all — a transient failure (email provider timeout, a momentary DB
// blip) was a silent, permanent drop with no second attempt. 3 tries
// with exponential backoff starting at 5s (5s, 10s, 20s) mirrors this
// codebase's own `AiService` retry precedent (`2 ** attempt * 200ms`,
// see `modules/ai/services/aiService.js`) scaled up for a job that's
// allowed to take longer than an inline HTTP request.
const DELIVERY_JOB_ATTEMPTS = 3;
const DELIVERY_JOB_BACKOFF_DELAY_MS = 5000;

const log = getModuleLogger('notifications');

/**
 * @returns {{queue: Queue, enqueueDelivery: (data: {notificationId: number, channel: string}) => Promise<void>}}
 */
export function createNotificationDeliveryQueue() {
  const connection = createQueueConnection();
  const queue = new Queue(NOTIFICATION_DELIVERY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: DELIVERY_JOB_ATTEMPTS,
      backoff: { type: 'exponential', delay: DELIVERY_JOB_BACKOFF_DELAY_MS },
    },
  });

  async function enqueueDelivery({ notificationId, channel }) {
    await queue.add('deliver', { notificationId, channel });
  }

  return { queue, enqueueDelivery };
}

/**
 * @param {object} deps
 * @param {Queue} deps.queue - the same `Queue` instance `enqueueDelivery` adds jobs to
 * @param {import('../services/notificationDeliveryService.js').NotificationDeliveryService} deps.notificationDeliveryService
 * @returns {{queue: Queue, worker: Worker}} kept open for the process
 *   lifetime; `server.js`'s shutdown handler closes them alongside the
 *   other queues/MySQL pool/Redis connection.
 */
export function registerNotificationDeliveryWorker({
  queue,
  notificationDeliveryService,
}) {
  const connection = createQueueConnection();

  const worker = new Worker(
    NOTIFICATION_DELIVERY_QUEUE_NAME,
    async (job) => {
      const { notificationId, channel } = job.data;
      await notificationDeliveryService.deliverViaChannel(
        notificationId,
        channel,
      );
    },
    { connection },
  );
  worker.on('failed', (job, err) => {
    log.error(
      { err, jobId: job?.id, data: job?.data },
      'Notification delivery job failed',
    );
  });

  return { queue, worker };
}

export default createNotificationDeliveryQueue;
