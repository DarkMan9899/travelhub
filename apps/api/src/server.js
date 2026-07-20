/**
 * Process entry point.
 *
 * Starts the Express app (src/app.js) and handles graceful shutdown —
 * closing the MySQL pool and Redis connection cleanly on SIGTERM/SIGINT,
 * consistent with BACKEND_ARCHITECTURE.md §59's stateless, horizontally-
 * scaled application-tier model (any instance can be stopped/started
 * without coordination, provided it shuts down cleanly).
 */

import app, { services } from './app.js';
import config from './config/index.js';
import logger from './logging/logger.js';
import { closeMysqlPool } from './infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from './infrastructure/cache/redisClient.js';
import { registerHoldExpirySweepJob } from './modules/booking-holds/jobs/holdExpirySweep.js';
import { registerPendingVendorSlaSweepJob } from './modules/bookings/jobs/pendingVendorSlaSweep.js';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'travelhub-api started');
});

// Sprint 10: scheduled jobs (BullMQ), registered only here — never in
// app.js — so importing app.js for tests (supertest) never starts a
// Redis-backed worker as a side effect.
const holdExpirySweep = registerHoldExpirySweepJob({
  availabilityService: services.availabilityService,
});
const pendingVendorSlaSweep = registerPendingVendorSlaSweepJob({
  bookingService: services.bookingService,
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
    await Promise.all([
      holdExpirySweep.worker.close(),
      holdExpirySweep.queue.close(),
      pendingVendorSlaSweep.worker.close(),
      pendingVendorSlaSweep.queue.close(),
    ]);
    await closeMysqlPool();
    await closeRedisConnection();
    logger.info('Shutdown complete');
    process.exit(0);
  });

  // Force-exit if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
