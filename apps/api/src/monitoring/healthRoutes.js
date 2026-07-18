/**
 * Health check endpoints.
 *
 * Implements BACKEND_ARCHITECTURE.md §50:
 *  - /health/live  — is the process itself responsive (used by
 *    orchestration to decide whether to restart an instance).
 *  - /health/ready — are this instance's dependencies (MySQL, Redis)
 *    actually reachable (used to decide whether to route traffic here).
 *
 * Both are unauthenticated, lightweight, and never touch business logic
 * or the queue system directly — this is the one piece of "real"
 * request-handling code Sprint 1 produces, and only because it is the
 * simplest possible proof that the Docker/CI/deployment pipeline and the
 * MySQL/Redis connections configured this sprint actually work end-to-end.
 */

import { Router } from 'express';
import { pingMysql } from '../infrastructure/database/mysqlPool.js';
import { pingRedis } from '../infrastructure/cache/redisClient.js';

const router = Router();

router.get('/health/live', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'live' },
    meta: null,
    error: null,
  });
});

router.get('/health/ready', async (req, res) => {
  const checks = { mysql: false, redis: false };

  try {
    checks.mysql = await pingMysql();
  } catch (err) {
    req.log?.warn({ err }, 'Readiness check: MySQL unreachable');
  }

  try {
    checks.redis = await pingRedis();
  } catch (err) {
    req.log?.warn({ err }, 'Readiness check: Redis unreachable');
  }

  const isReady = checks.mysql && checks.redis;

  res.status(isReady ? 200 : 503).json({
    success: isReady,
    data: { status: isReady ? 'ready' : 'not_ready', checks },
    meta: null,
    error: isReady
      ? null
      : {
          code: 'SERVICE_UNAVAILABLE',
          message: 'One or more dependencies are unreachable.',
          details: undefined,
          request_id: req.requestId,
        },
  });
});

export default router;
