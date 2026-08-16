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

const log = getModuleLogger('notifications');

/**
 * @returns {{queue: Queue, enqueueDelivery: (data: {notificationId: number, channel: string}) => Promise<void>}}
 */
export function createNotificationDeliveryQueue() {
  const connection = createQueueConnection();
  const queue = new Queue(NOTIFICATION_DELIVERY_QUEUE_NAME, { connection });

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
