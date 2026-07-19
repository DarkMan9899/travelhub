/**
 * Express application assembly.
 *
 * Implements BACKEND_ARCHITECTURE.md §11 (Middleware): composed once,
 * in a fixed, documented order —
 *   1. Security headers (helmet) + CORS
 *   2. Body parsing
 *   3. Request context (request_id, logger — src/middleware/requestContext.js)
 *   4. Rate-limit foundation (src/middleware/rateLimiter.js, §48)
 *   5. Routes (health checks, unversioned; `/api/v1` mount point, §49 —
 *      no module routers are mounted under it yet, per each module's
 *      README.md "scaffold only" status)
 *   6. 404 handler
 *   7. Global error handler (src/middleware/errorHandler.js) — always last
 *
 * Sprint 1 scope was the composition itself plus health checks. Sprint 5
 * adds the rate-limit foundation and the `/api/v1` mount point — still no
 * business/module routes, which remain future-sprint work.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/index.js';
import logger from './logging/logger.js';
import requestContext from './middleware/requestContext.js';
import { publicRateLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import healthRoutes from './monitoring/healthRoutes.js';
import v1Routes from './routes/v1.js';
import { NotFoundError } from './errors/AppError.js';

const app = express();

app.set('logger', logger);
app.disable('x-powered-by');

// 1. Security headers + CORS (BACKEND_ARCHITECTURE.md §47)
app.use(helmet());
app.use(
  cors({
    origin: config.cors.allowedOrigins,
    credentials: true,
  }),
);

// 2. Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// 3. Request context (request_id + scoped logger)
app.use(requestContext);

// 4. Rate-limit foundation — global baseline, before any route/Controller
// code (BACKEND_ARCHITECTURE.md §48). Health checks are exempt: orchestration
// liveness/readiness probes must never be throttled.
app.use((req, res, next) => {
  if (req.path.startsWith('/health/')) return next();
  return publicRateLimiter(req, res, next);
});

// 5. Routes — health checks (unversioned) + the /api/v1 mount point.
// Module routers are registered inside src/routes/v1.js in future sprints,
// per API_SPECIFICATION.md's /api/v1 prefix (BACKEND_ARCHITECTURE.md §49).
app.use(healthRoutes);
app.use('/api/v1', v1Routes);

// 6. 404 — no matching route
app.use((req, res, next) => {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}`));
});

// 7. Global error handler — always last
app.use(errorHandler);

export default app;
