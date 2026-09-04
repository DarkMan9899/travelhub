/**
 * Inventory Connectivity route wiring (Phase 17 §15-28) — a separate
 * router file from `module.routes.js` (mounted at a different base path
 * in `routes/v1.js`, `/inventory-connections`) since these endpoints
 * manage connector configuration/sync, a distinct resource family from
 * `bookable_units`/`availability_calendar`/`blackout_dates`, even though
 * both live in the `availability` module.
 *
 * `GET /export/:token` is the one deliberately public, unauthenticated
 * route (Phase 17 §20) — gated by the opaque `export_token` itself, not
 * a session; mounted here rather than under `/inventory-connections/:id`
 * so the token, not a guessable numeric id, is the only thing that
 * grants access.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  createConnectionSchema,
  connectionIdParamsSchema,
  updateConnectionSchema,
  listConnectionsQuerySchema,
  adminOverviewSchema,
  setMappingSchema,
  resolveConflictSchema,
  exportTokenParamsSchema,
} from './validators/inventoryConnectionValidators.js';

export default function createInventoryConnectionRoutes({
  inventoryConnectionController,
  guards,
}) {
  const router = Router();
  const { requireAuth } = guards;

  router.post(
    '/',
    requireAuth,
    validate(createConnectionSchema),
    inventoryConnectionController.create,
  );
  router.get(
    '/',
    requireAuth,
    validate(listConnectionsQuerySchema),
    inventoryConnectionController.list,
  );
  // Admin Sprint 5 — registered ahead of `/:id` and `/:id/conflicts`
  // deliberately: `/admin/conflicts` is structurally a two-segment path
  // that `/:id/conflicts` would otherwise capture first (id="admin"),
  // the same route-order hazard `module.routes.js`'s own header comment
  // documents for `/units`/`/blackouts` vs `/:listingId`.
  router.get(
    '/admin/overview',
    requireAuth,
    validate(adminOverviewSchema),
    inventoryConnectionController.adminOverview,
  );
  router.get(
    '/admin/conflicts',
    requireAuth,
    validate(adminOverviewSchema),
    inventoryConnectionController.adminConflicts,
  );
  router.get(
    '/:id',
    requireAuth,
    validate(connectionIdParamsSchema),
    inventoryConnectionController.get,
  );
  router.patch(
    '/:id',
    requireAuth,
    validate(updateConnectionSchema),
    inventoryConnectionController.update,
  );
  router.delete(
    '/:id',
    requireAuth,
    validate(connectionIdParamsSchema),
    inventoryConnectionController.disconnect,
  );
  router.post(
    '/:id/mapping',
    requireAuth,
    validate(setMappingSchema),
    inventoryConnectionController.setMapping,
  );
  router.post(
    '/:id/test',
    requireAuth,
    validate(connectionIdParamsSchema),
    inventoryConnectionController.testConnection,
  );
  router.post(
    '/:id/sync',
    requireAuth,
    validate(connectionIdParamsSchema),
    inventoryConnectionController.syncNow,
  );
  router.get(
    '/:id/sync-runs',
    requireAuth,
    validate(connectionIdParamsSchema),
    inventoryConnectionController.listSyncRuns,
  );
  router.get(
    '/:id/conflicts',
    requireAuth,
    validate(connectionIdParamsSchema),
    inventoryConnectionController.listSyncConflicts,
  );
  router.post(
    '/:id/conflicts/:conflictId/resolve',
    requireAuth,
    validate(resolveConflictSchema),
    inventoryConnectionController.resolveConflict,
  );

  // Public — gated by the opaque token itself (spec §20).
  router.get(
    '/export/:token',
    validate(exportTokenParamsSchema),
    inventoryConnectionController.getExportFeed,
  );

  return router;
}
