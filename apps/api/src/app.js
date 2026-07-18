/**
 * Express application assembly.
 *
 * Implements BACKEND_ARCHITECTURE.md §11 (Middleware): composed once,
 * in a fixed, documented order —
 *   1. Security headers (helmet) + CORS
 *   2. Body parsing
 *   3. Request context (request_id, logger — src/middleware/requestContext.js)
 *   4. Routes (health checks only in Sprint 1; module routers are mounted
 *      here in future sprints, per BACKEND_ARCHITECTURE.md §2's
 *      `module.routes.js` convention)
 *   5. 404 handler
 *   6. Global error handler (src/middleware/errorHandler.js) — always last
 *
 * Sprint 1 scope: the composition itself, plus the health check routes
 * (BACKEND_ARCHITECTURE.md §50). No business/module routes are mounted
 * yet — see each module's README.md for its Sprint-1 "scaffold only"
 * status.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import config from './config/index.js';
import logger from './logging/logger.js';
import requestContext from './middleware/requestContext.js';
import errorHandler from './middleware/errorHandler.js';
import healthRoutes from './monitoring/healthRoutes.js';
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

// 4. Routes
app.use(healthRoutes);

// Module routers are mounted below in future sprints, e.g.:
//   app.use('/api/v1/auth', authRouter);
//   app.use('/api/v1/listings', listingsRouter);
// per API_SPECIFICATION.md's /api/v1 prefix (BACKEND_ARCHITECTURE.md §49).

// 5. 404 — no matching route
app.use((req, res, next) => {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}`));
});

// 6. Global error handler — always last
app.use(errorHandler);

export default app;
