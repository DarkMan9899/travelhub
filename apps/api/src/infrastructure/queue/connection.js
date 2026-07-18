/**
 * BullMQ base connection.
 *
 * Implements BACKEND_ARCHITECTURE.md §35 (Queue Architecture): BullMQ is
 * the platform's sole asynchronous job mechanism. This file provides the
 * shared Redis connection options every queue/worker uses — organized
 * per concern (Ch. 35), not per module.
 *
 * Sprint 1 scope: the connection factory only. No queues are registered
 * and no job processors exist yet — those are added per-module starting
 * with the modules that need them (see BACKEND_ARCHITECTURE.md Part XII
 * for the full background-jobs catalog this will eventually implement).
 */

import IORedis from 'ioredis';
import config from '../../config/index.js';

/**
 * BullMQ requires `maxRetriesPerRequest: null` on its Redis connection
 * (a BullMQ-specific requirement, distinct from the shared cache client
 * in src/infrastructure/cache/redisClient.js, which intentionally uses a
 * separate connection per BACKEND_ARCHITECTURE.md §38).
 */
export function createQueueConnection() {
  return new IORedis(config.redis.url, {
    maxRetriesPerRequest: null,
  });
}

export default createQueueConnection;
