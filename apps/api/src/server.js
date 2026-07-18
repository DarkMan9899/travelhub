/**
 * Process entry point.
 *
 * Starts the Express app (src/app.js) and handles graceful shutdown —
 * closing the MySQL pool and Redis connection cleanly on SIGTERM/SIGINT,
 * consistent with BACKEND_ARCHITECTURE.md §59's stateless, horizontally-
 * scaled application-tier model (any instance can be stopped/started
 * without coordination, provided it shuts down cleanly).
 */

import app from './app.js';
import config from './config/index.js';
import logger from './logging/logger.js';
import { closeMysqlPool } from './infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from './infrastructure/cache/redisClient.js';

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.env }, 'travelhub-api started');
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close(async () => {
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
