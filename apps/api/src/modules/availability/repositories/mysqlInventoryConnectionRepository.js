/**
 * MySQL-backed repository for `inventory_connections`,
 * `inventory_connection_mappings`, `inventory_sync_runs`, and
 * `inventory_sync_conflicts` (Phase 17 §15-28) — grouped in one file
 * since they're four small, always-accessed-together tables belonging
 * to the same "connector configuration + sync history" concept, the
 * same "one repository per closely-related table cluster" precedent
 * `mysqlAvailabilityCalendarRepository.js` already sets for its own
 * `availability_statuses`/`currencies` joins.
 */

import { getMysqlPool } from '../../../infrastructure/database/mysqlPool.js';
import { mapMysqlError } from '../../../infrastructure/database/errorMapping.js';
import {
  encryptConnectorConfig,
  decryptConnectorConfig,
} from '../../../infrastructure/security/connectorCredentialCipher.js';

function connectionToDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    partnerId: row.partner_id,
    listingId: row.listing_id,
    connectorType: row.connector_type,
    direction: row.direction,
    name: row.name,
    status: row.status,
    // P0.6: transparently decrypted here — never re-encrypted or
    // re-serialized outward past this repository boundary.
    // `toConnectionResponse` (inventoryConnectionController.js) never
    // reads `.config` at all, so a decrypted value in this domain
    // object never reaches an HTTP response; the only real consumers
    // are `#executeSync`/`testConnection`, which genuinely need it.
    config: decryptConnectorConfig(row.config),
    webhookSecret: row.webhook_secret,
    exportToken: row.export_token,
    lastAttemptedSyncAt: row.last_attempted_sync_at,
    lastSuccessfulSyncAt: row.last_successful_sync_at,
    lastError: row.last_error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mappingToDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    externalResourceId: row.external_resource_id,
    externalResourceName: row.external_resource_name,
    bookableUnitId: row.bookable_unit_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function syncRunToDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    connectionId: row.connection_id,
    direction: row.direction,
    triggerCode: row.trigger_code,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    recordsReceived: row.records_received,
    recordsCreated: row.records_created,
    recordsUpdated: row.records_updated,
    recordsSkipped: row.records_skipped,
    conflictsCount: row.conflicts_count,
    errorMessage: row.error_message,
  };
}

function conflictToDomain(row) {
  if (!row) return null;
  return {
    id: row.id,
    syncRunId: row.sync_run_id,
    connectionId: row.connection_id,
    externalEventUid: row.external_event_uid,
    conflictType: row.conflict_type,
    details:
      typeof row.details === 'string'
        ? JSON.parse(row.details)
        : (row.details ?? null),
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
  };
}

const CONNECTION_COLUMNS = `id, partner_id, listing_id, connector_type, direction, name, status,
  config, webhook_secret, export_token, last_attempted_sync_at, last_successful_sync_at,
  last_error, created_by, created_at, updated_at, deleted_at`;

export class MySqlInventoryConnectionRepository {
  #pool;

  constructor(pool = getMysqlPool()) {
    this.#pool = pool;
  }

  // --- inventory_connections ---

  async create(
    {
      partnerId,
      listingId,
      connectorType,
      direction,
      name,
      config,
      webhookSecret,
      exportToken,
      createdBy,
    },
    connection = this.#pool,
  ) {
    try {
      const [result] = await connection.query(
        `INSERT INTO inventory_connections
          (partner_id, listing_id, connector_type, direction, name, config, webhook_secret, export_token, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          partnerId,
          listingId ?? null,
          connectorType,
          direction,
          name,
          encryptConnectorConfig(config ?? null),
          webhookSecret ?? null,
          exportToken ?? null,
          createdBy,
        ],
      );
      return this.findById(result.insertId, connection);
    } catch (err) {
      throw mapMysqlError(err);
    }
  }

  async findById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${CONNECTION_COLUMNS} FROM inventory_connections WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    return connectionToDomain(rows[0]);
  }

  async findByExportToken(token, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${CONNECTION_COLUMNS} FROM inventory_connections WHERE export_token = ? AND deleted_at IS NULL`,
      [token],
    );
    return connectionToDomain(rows[0]);
  }

  async listForPartner(partnerId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${CONNECTION_COLUMNS} FROM inventory_connections
       WHERE partner_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
      [partnerId],
    );
    return rows.map(connectionToDomain);
  }

  /**
   * Every non-deleted connection whose status isn't `DISCONNECTED`
   * (system-wide, no partner scope) — the scheduled reconciliation
   * sweep's read (`inventoryReconciliationSweep.js`), never exposed on
   * an HTTP route.
   */
  async listAllActive(connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT ${CONNECTION_COLUMNS} FROM inventory_connections
       WHERE status != 'DISCONNECTED' AND deleted_at IS NULL
       ORDER BY id ASC`,
    );
    return rows.map(connectionToDomain);
  }

  async update(id, fields, connection = this.#pool) {
    const sets = [];
    const values = [];
    if (fields.name !== undefined) {
      sets.push('name = ?');
      values.push(fields.name);
    }
    if (fields.config !== undefined) {
      sets.push('config = ?');
      values.push(encryptConnectorConfig(fields.config));
    }
    if (fields.status !== undefined) {
      sets.push('status = ?');
      values.push(fields.status);
    }
    if (fields.lastAttemptedSyncAt !== undefined) {
      sets.push('last_attempted_sync_at = ?');
      values.push(fields.lastAttemptedSyncAt);
    }
    if (fields.lastSuccessfulSyncAt !== undefined) {
      sets.push('last_successful_sync_at = ?');
      values.push(fields.lastSuccessfulSyncAt);
    }
    if (fields.lastError !== undefined) {
      sets.push('last_error = ?');
      values.push(fields.lastError);
    }
    if (sets.length === 0) return this.findById(id, connection);
    values.push(id);
    await connection.query(
      `UPDATE inventory_connections SET ${sets.join(', ')} WHERE id = ?`,
      values,
    );
    return this.findById(id, connection);
  }

  async softDelete(id, connection = this.#pool) {
    await connection.query(
      `UPDATE inventory_connections SET deleted_at = CURRENT_TIMESTAMP(3), status = 'DISCONNECTED' WHERE id = ?`,
      [id],
    );
  }

  // --- inventory_connection_mappings ---

  async upsertMapping(
    { connectionId, externalResourceId, externalResourceName, bookableUnitId },
    connection = this.#pool,
  ) {
    await connection.query(
      `INSERT INTO inventory_connection_mappings
        (connection_id, external_resource_id, external_resource_name, bookable_unit_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE external_resource_name = VALUES(external_resource_name),
                               bookable_unit_id = VALUES(bookable_unit_id)`,
      [
        connectionId,
        externalResourceId,
        externalResourceName ?? null,
        bookableUnitId,
      ],
    );
    const [rows] = await connection.query(
      `SELECT id, connection_id, external_resource_id, external_resource_name, bookable_unit_id, created_at, updated_at
       FROM inventory_connection_mappings WHERE connection_id = ? AND external_resource_id = ?`,
      [connectionId, externalResourceId],
    );
    return mappingToDomain(rows[0]);
  }

  async listMappings(connectionId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, connection_id, external_resource_id, external_resource_name, bookable_unit_id, created_at, updated_at
       FROM inventory_connection_mappings WHERE connection_id = ?`,
      [connectionId],
    );
    return rows.map(mappingToDomain);
  }

  // --- inventory_sync_runs ---

  async createSyncRun(
    { connectionId, direction, triggerCode },
    connection = this.#pool,
  ) {
    const [result] = await connection.query(
      `INSERT INTO inventory_sync_runs (connection_id, direction, trigger_code) VALUES (?, ?, ?)`,
      [connectionId, direction, triggerCode],
    );
    return this.findSyncRunById(result.insertId, connection);
  }

  async findSyncRunById(id, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, connection_id, direction, trigger_code, status, started_at, finished_at,
              records_received, records_created, records_updated, records_skipped, conflicts_count, error_message
       FROM inventory_sync_runs WHERE id = ?`,
      [id],
    );
    return syncRunToDomain(rows[0]);
  }

  async finishSyncRun(id, fields, connection = this.#pool) {
    await connection.query(
      `UPDATE inventory_sync_runs SET
        finished_at = CURRENT_TIMESTAMP(3), status = ?, records_received = ?,
        records_created = ?, records_updated = ?, records_skipped = ?, conflicts_count = ?, error_message = ?
       WHERE id = ?`,
      [
        fields.status,
        fields.recordsReceived ?? 0,
        fields.recordsCreated ?? 0,
        fields.recordsUpdated ?? 0,
        fields.recordsSkipped ?? 0,
        fields.conflictsCount ?? 0,
        fields.errorMessage ?? null,
        id,
      ],
    );
    return this.findSyncRunById(id, connection);
  }

  async listSyncRunsForConnection(connectionId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, connection_id, direction, trigger_code, status, started_at, finished_at,
              records_received, records_created, records_updated, records_skipped, conflicts_count, error_message
       FROM inventory_sync_runs WHERE connection_id = ? ORDER BY started_at DESC LIMIT 50`,
      [connectionId],
    );
    return rows.map(syncRunToDomain);
  }

  // --- inventory_sync_conflicts ---

  async createConflict(
    { syncRunId, connectionId, externalEventUid, conflictType, details },
    connection = this.#pool,
  ) {
    const [result] = await connection.query(
      `INSERT INTO inventory_sync_conflicts (sync_run_id, connection_id, external_event_uid, conflict_type, details)
       VALUES (?, ?, ?, ?, ?)`,
      [
        syncRunId,
        connectionId,
        externalEventUid ?? null,
        conflictType,
        details ? JSON.stringify(details) : null,
      ],
    );
    return result.insertId;
  }

  async listUnresolvedForConnection(connectionId, connection = this.#pool) {
    const [rows] = await connection.query(
      `SELECT id, sync_run_id, connection_id, external_event_uid, conflict_type, details,
              resolved_at, resolved_by, resolution_note, created_at
       FROM inventory_sync_conflicts WHERE connection_id = ? AND resolved_at IS NULL
       ORDER BY created_at DESC`,
      [connectionId],
    );
    return rows.map(conflictToDomain);
  }

  async resolveConflict(
    id,
    { resolvedBy, resolutionNote },
    connection = this.#pool,
  ) {
    await connection.query(
      `UPDATE inventory_sync_conflicts SET resolved_at = CURRENT_TIMESTAMP(3), resolved_by = ?, resolution_note = ?
       WHERE id = ? AND resolved_at IS NULL`,
      [resolvedBy, resolutionNote ?? null, id],
    );
  }
}

export default MySqlInventoryConnectionRepository;
