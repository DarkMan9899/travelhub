/**
 * `/api/v1` router aggregator.
 *
 * Implements BACKEND_ARCHITECTURE.md §49 (API Versioning): URL path
 * versioning, routing versioned by directory rather than runtime
 * feature-flagging — this file is that directory's entry point. Each
 * module's future `module.routes.js` (Ch.2) is mounted here, e.g.:
 *   import authRoutes from '../modules/auth/module.routes.js';
 *   router.use('/auth', authRoutes);
 *
 * Sprint 5 scope: the mount point itself. No module routes exist yet —
 * this sprint is database/infrastructure foundation only
 * (`apps/api/src/modules/*` remain scaffold-only until their own sprint).
 */

import { Router } from 'express';

const router = Router();

// Module routers are mounted here in future sprints.

export default router;
