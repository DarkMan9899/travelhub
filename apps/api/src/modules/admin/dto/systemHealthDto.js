/**
 * System Health module response DTO — Stage 11.8 Admin Platform.
 */

export function toSystemHealthResponse(health) {
  return {
    database: {
      status: health.database.status,
      latency_ms: health.database.latencyMs,
    },
    cache: {
      status: health.cache.status,
      latency_ms: health.cache.latencyMs,
    },
    queues: health.queues.map((queue) => ({
      name: queue.name,
      status: queue.status,
      waiting: queue.waiting,
      active: queue.active,
      delayed: queue.delayed,
      failed: queue.failed,
    })),
    environment: health.environment,
    version: health.version,
  };
}

export default toSystemHealthResponse;
