/**
 * SystemHealthService — Stage 11.8 Admin Platform.
 *
 * Unlike every other admin service, this one has no owning repository:
 * there is no table behind it, only live infra probes (DB ping, Redis
 * ping, BullMQ queue depth) — the same reasoning `src/monitoring/
 * healthRoutes.js`'s public `/health/ready` already applies by calling
 * `pingMysql`/`pingRedis` directly rather than through a repository
 * layer. This is the authenticated, admin-only counterpart: richer
 * output (queue depth, environment, version), gated by the admin-area
 * role `module.routes.js` already enforces — no extra permission, same
 * as `GET /admin/dashboard`.
 *
 * The two BullMQ queues (`booking-holds.expiry-sweep`,
 * `bookings.pending-vendor-sla-sweep`) are registered only in
 * `server.js`, never in `app.js`'s composition root (by design — see
 * that file's own comment), so this service can't import their live
 * instances. It opens its own short-lived, read-only `Queue` client per
 * request instead — BullMQ supports multiple `Queue` objects against the
 * same queue name safely; this never starts a worker.
 */

import { Queue } from 'bullmq';
import { createRequire } from 'module';
import { pingMysql } from '../../../infrastructure/database/mysqlPool.js';
import { pingRedis } from '../../../infrastructure/cache/redisClient.js';
import { createQueueConnection } from '../../../infrastructure/queue/connection.js';
import config from '../../../config/index.js';

const require = createRequire(import.meta.url);
const { version } = require('../../../../package.json');

const QUEUE_JOB_COUNT_TIMEOUT_MS = 3000;
const QUEUE_NAMES = [
  'booking-holds.expiry-sweep',
  'bookings.pending-vendor-sla-sweep',
  'notifications.delivery',
  'availability.inventory-reconciliation-sweep',
];

async function checkDatabase() {
  const startedAt = Date.now();
  try {
    await pingMysql();
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch {
    return { status: 'down', latencyMs: null };
  }
}

async function checkCache() {
  const startedAt = Date.now();
  try {
    await pingRedis();
    return { status: 'up', latencyMs: Date.now() - startedAt };
  } catch {
    return { status: 'down', latencyMs: null };
  }
}

async function getJobCountsWithTimeout(queue) {
  let timer;
  try {
    return await Promise.race([
      queue.getJobCounts('waiting', 'active', 'delayed', 'failed'),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Queue job-count check timed out')),
          QUEUE_JOB_COUNT_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkQueues() {
  const connection = createQueueConnection();
  try {
    return await Promise.all(
      QUEUE_NAMES.map(async (name) => {
        try {
          const queue = new Queue(name, { connection });
          const counts = await getJobCountsWithTimeout(queue);
          return { name, status: 'up', ...counts };
        } catch {
          return {
            name,
            status: 'down',
            waiting: null,
            active: null,
            delayed: null,
            failed: null,
          };
        }
      }),
    );
  } finally {
    connection.disconnect();
  }
}

export class SystemHealthService {
  // eslint-disable-next-line class-methods-use-this
  async getSystemHealth() {
    const [database, cache, queues] = await Promise.all([
      checkDatabase(),
      checkCache(),
      checkQueues(),
    ]);
    return {
      database,
      cache,
      queues,
      environment: config.env,
      version,
    };
  }
}

export default SystemHealthService;
