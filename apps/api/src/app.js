/**
 * Express application assembly + composition root.
 *
 * Implements BACKEND_ARCHITECTURE.md §11 (Middleware): composed once,
 * in a fixed, documented order —
 *   1. Security headers (helmet) + CORS
 *   2. Body parsing (JSON/urlencoded/cookies)
 *   3. Request context (request_id, logger — src/middleware/requestContext.js)
 *   4. Authentication (src/guards/authenticate.js, §12) — populates
 *      req.principal if a valid token is present; never rejects
 *   5. Rate-limit foundation (src/middleware/rateLimiter.js, §48)
 *   6. Routes (health checks, unversioned; `/api/v1` mount point, §49)
 *   7. 404 handler
 *   8. Global error handler (src/middleware/errorHandler.js) — always last
 *
 * This file is also the DI composition root (§17): every concrete
 * infrastructure adapter (Repository implementations) is constructed
 * exactly once, here, and wired to the core port/service that depends on
 * it — nothing below this point ever constructs its own dependency with
 * `new` on a concrete infrastructure class.
 */

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config/index.js';
import logger from './logging/logger.js';
import requestContext from './middleware/requestContext.js';
import authenticate from './guards/authenticate.js';
import requireAuth from './guards/requireAuth.js';
import { requireRole } from './guards/requireRole.js';
import { createRequirePermissionGuard } from './guards/requirePermission.js';
import { createRequireHostGuard } from './guards/requireHost.js';
import { publicRateLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import healthRoutes from './monitoring/healthRoutes.js';
import createV1Router from './routes/v1.js';
import { NotFoundError } from './errors/AppError.js';
import { AuditLogger } from './core/domain/auditLogger.js';
import { MySqlAuditLogRepository } from './infrastructure/database/repositories/auditLogRepository.js';
import { PermissionResolver } from './core/domain/permissionResolver.js';
import { MySqlPermissionRepository } from './infrastructure/database/repositories/permissionRepository.js';
import { CachedPermissionRepository } from './infrastructure/cache/cachedPermissionRepository.js';
import { isPartnerOwner } from './infrastructure/database/repositories/partnerEmployeeRepository.js';

const app = express();

app.set('logger', logger);
app.disable('x-powered-by');

// --- Composition root (BACKEND_ARCHITECTURE.md §17) ---
const auditLogger = new AuditLogger(new MySqlAuditLogRepository());
const permissionResolver = new PermissionResolver(
  new CachedPermissionRepository(new MySqlPermissionRepository()),
);
const guards = {
  requireAuth,
  requireRole,
  requirePermission: createRequirePermissionGuard(permissionResolver),
  // Sprint 6's "Host" role -> the existing partner-scoped OWNER role
  // (docs/SPRINT_6_AUTH_FOUNDATION.md, Architecture Decisions #1).
  requireHost: createRequireHostGuard(isPartnerOwner),
};

// 1. Security headers + CORS (BACKEND_ARCHITECTURE.md §47)
app.use(helmet());
app.use(
  cors({
    origin: config.cors.allowedOrigins,
    credentials: true,
  }),
);

// 2. Body parsing — cookieParser reads the httpOnly refresh-token cookie
// web clients rely on (FRONTEND_ARCHITECTURE.md §34.1); setting a cookie
// needs no extra middleware, only reading one back does.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 3. Request context (request_id + scoped logger)
app.use(requestContext);

// 4. Authentication — populate-only, never rejects (BACKEND_ARCHITECTURE.md §11's order).
app.use(authenticate);

// 5. Rate-limit foundation — global baseline, before any route/Controller
// code (BACKEND_ARCHITECTURE.md §48). Health checks are exempt: orchestration
// liveness/readiness probes must never be throttled.
app.use((req, res, next) => {
  if (req.path.startsWith('/health/')) return next();
  return publicRateLimiter(req, res, next);
});

// 6. Routes — health checks (unversioned) + the /api/v1 mount point.
app.use(healthRoutes);
const v1 = createV1Router({ guards, auditLogger, permissionResolver });
app.use('/api/v1', v1.router);

// Sprint 10: exposes the Service instances `server.js` needs to register
// the hold-expiry/pending-vendor-SLA scheduled jobs. Not used by app.js
// itself, and never imported by tests (which import `app` only) — no
// BullMQ worker starts as a side effect of importing this module.
export const services = {
  availabilityService: v1.availabilityService,
  bookingService: v1.bookingService,
};

// 7. 404 — no matching route
app.use((req, res, next) => {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl}`));
});

// 8. Global error handler — always last
app.use(errorHandler);

export default app;
