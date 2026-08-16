/**
 * InventoryConnection Controller — parse input -> call Service -> shape
 * response, no business logic (mirrors `availabilityController.js`).
 */

function toConnectionResponse(connection) {
  return {
    id: connection.id,
    partner_id: connection.partnerId,
    listing_id: connection.listingId,
    connector_type: connection.connectorType,
    direction: connection.direction,
    name: connection.name,
    status: connection.status,
    export_token: connection.exportToken,
    last_attempted_sync_at: connection.lastAttemptedSyncAt,
    last_successful_sync_at: connection.lastSuccessfulSyncAt,
    last_error: connection.lastError,
    created_at: connection.createdAt,
  };
}

function toSyncRunResponse(run) {
  return {
    id: run.id,
    connection_id: run.connectionId,
    direction: run.direction,
    trigger_code: run.triggerCode,
    status: run.status,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    records_received: run.recordsReceived,
    records_created: run.recordsCreated,
    records_updated: run.recordsUpdated,
    records_skipped: run.recordsSkipped,
    conflicts_count: run.conflictsCount,
    error_message: run.errorMessage,
  };
}

function toConflictResponse(conflict) {
  return {
    id: conflict.id,
    sync_run_id: conflict.syncRunId,
    external_event_uid: conflict.externalEventUid,
    conflict_type: conflict.conflictType,
    details: conflict.details,
    created_at: conflict.createdAt,
  };
}

function toMappingResponse(mapping) {
  return {
    id: mapping.id,
    connection_id: mapping.connectionId,
    external_resource_id: mapping.externalResourceId,
    external_resource_name: mapping.externalResourceName,
    bookable_unit_id: mapping.bookableUnitId,
  };
}

export function createInventoryConnectionController(
  inventoryConnectionService,
) {
  return {
    async create(req, res, next) {
      try {
        const connection = await inventoryConnectionService.createConnection(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toConnectionResponse(connection),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async update(req, res, next) {
      try {
        const { id } = req.validated.params;
        const connection = await inventoryConnectionService.updateConnection(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toConnectionResponse(connection),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async disconnect(req, res, next) {
      try {
        const { id } = req.validated.params;
        await inventoryConnectionService.disconnectConnection(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: { disconnected: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const { partnerId } = req.validated.query;
        const connections = await inventoryConnectionService.listConnections(
          req.principal,
          partnerId,
        );
        res.status(200).json({
          success: true,
          data: connections.map(toConnectionResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async get(req, res, next) {
      try {
        const { id } = req.validated.params;
        const connection = await inventoryConnectionService.getConnection(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: toConnectionResponse(connection),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async setMapping(req, res, next) {
      try {
        const { id } = req.validated.params;
        const mapping = await inventoryConnectionService.setMapping(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toMappingResponse(mapping),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async testConnection(req, res, next) {
      try {
        const { id } = req.validated.params;
        const result = await inventoryConnectionService.testConnection(
          req.principal,
          id,
        );
        res
          .status(200)
          .json({ success: true, data: result, meta: null, error: null });
      } catch (err) {
        next(err);
      }
    },

    async syncNow(req, res, next) {
      try {
        const { id } = req.validated.params;
        const run = await inventoryConnectionService.syncNow(
          req.principal,
          id,
          { triggerCode: 'MANUAL' },
        );
        res.status(200).json({
          success: true,
          data: toSyncRunResponse(run),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listSyncRuns(req, res, next) {
      try {
        const { id } = req.validated.params;
        const runs = await inventoryConnectionService.listSyncRuns(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: runs.map(toSyncRunResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listSyncConflicts(req, res, next) {
      try {
        const { id } = req.validated.params;
        const conflicts = await inventoryConnectionService.listSyncConflicts(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: conflicts.map(toConflictResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async resolveConflict(req, res, next) {
      try {
        const { id, conflictId } = req.validated.params;
        await inventoryConnectionService.resolveConflict(
          req.principal,
          id,
          conflictId,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: { resolved: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    /** Public, unauthenticated iCal export feed — text/calendar, not the standard JSON envelope. */
    async getExportFeed(req, res, next) {
      try {
        const { token } = req.validated.params;
        const icsText = await inventoryConnectionService.getExportFeed(token);
        res
          .status(200)
          .set('Content-Type', 'text/calendar; charset=utf-8')
          .send(icsText);
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createInventoryConnectionController;
