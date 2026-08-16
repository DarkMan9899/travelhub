/**
 * InventoryConnectionService — public Service for the Connectivity
 * Platform slice of Phase 17 (§15-28): owns `inventory_connections`/
 * `inventory_connection_mappings`/`inventory_sync_runs`/
 * `inventory_sync_conflicts`, resolves connectors via
 * `ConnectorRegistry`, and drives a sync run's write side by calling
 * back into `AvailabilityService#applySystemExternalReservation`/
 * `#cancelSystemExternalReservation` — same-module composition (both
 * Services live in `modules/availability/`), the identical pattern
 * `AvailabilityService` already uses to compose `BookableUnitService`/
 * `BlackoutService`.
 */

import { randomBytes } from 'node:crypto';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../errors/AppError.js';
import {
  isPartnerOwner,
  getPartnerEmployeeRoleCode,
} from '../../../infrastructure/database/repositories/partnerEmployeeRepository.js';
import {
  roleHasCapability,
  PARTNER_CAPABILITIES,
} from '../../../core/domain/partnerCapabilities.js';
import { withTransaction } from '../../../infrastructure/database/transaction.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { ConnectorRegistry } from '../connectors/connectorRegistry.js';
import { ManualConnector } from '../connectors/manualConnector.js';
import { IcalConnector } from '../connectors/icalConnector.js';
import { buildIcsExport } from '../connectors/icalExport.js';

export const CONNECTOR_TYPES = Object.freeze([
  'MANUAL',
  'ICAL',
  'CSV',
  'GENERIC_API',
  'GENERIC_WEBHOOK',
]);
export const CONNECTION_DIRECTIONS = Object.freeze([
  'IMPORT',
  'EXPORT',
  'BOTH',
]);
const DEFAULT_MAPPING_KEY = 'default';

function buildDefaultRegistry() {
  return new ConnectorRegistry()
    .register(new ManualConnector())
    .register(new IcalConnector());
}

export class InventoryConnectionService {
  #inventoryConnectionRepository;

  #bookableUnitService;

  #externalReservationRepository;

  #listingService;

  #permissionResolver;

  #auditLogger;

  #eventBus;

  #availabilityService;

  #registry;

  constructor({
    inventoryConnectionRepository,
    bookableUnitService,
    externalReservationRepository,
    listingService,
    permissionResolver,
    auditLogger,
    eventBus = createNoOpEventBus(),
    registry = buildDefaultRegistry(),
  }) {
    this.#inventoryConnectionRepository = inventoryConnectionRepository;
    this.#bookableUnitService = bookableUnitService;
    this.#externalReservationRepository = externalReservationRepository;
    this.#listingService = listingService;
    this.#permissionResolver = permissionResolver;
    this.#auditLogger = auditLogger;
    this.#eventBus = eventBus;
    this.#registry = registry;
  }

  /** Late-bound — `AvailabilityService` and `InventoryConnectionService` are constructed together in `module.container.js`; this breaks the circular constructor-argument order without a circular import. */
  setAvailabilityService(availabilityService) {
    this.#availabilityService = availabilityService;
  }

  async #assertCapability(principal, partnerId, capability, adminPermission) {
    if (!principal) throw new AuthenticationError();
    if (await isPartnerOwner(principal.userId, partnerId)) return;
    const roleCode = await getPartnerEmployeeRoleCode(
      principal.userId,
      partnerId,
    );
    if (roleHasCapability(roleCode, capability)) return;
    if (
      adminPermission &&
      (await this.#permissionResolver.hasPermission(
        principal.roles,
        adminPermission,
      ))
    ) {
      return;
    }
    throw new AuthorizationError();
  }

  async #loadConnectionForCapability(
    principal,
    id,
    capability,
    adminPermission,
  ) {
    const connection = await this.#inventoryConnectionRepository.findById(id);
    if (!connection) throw new NotFoundError('Inventory connection not found.');
    await this.#assertCapability(
      principal,
      connection.partnerId,
      capability,
      adminPermission,
    );
    return connection;
  }

  async createConnection(
    principal,
    { partnerId, listingId, connectorType, direction, name, config },
  ) {
    if (!CONNECTOR_TYPES.includes(connectorType)) {
      throw new ValidationError('Unknown connector type.', [
        { field: 'connectorType', issue: 'UNKNOWN_CONNECTOR_TYPE' },
      ]);
    }
    if (!CONNECTION_DIRECTIONS.includes(direction)) {
      throw new ValidationError('Unknown connection direction.', [
        { field: 'direction', issue: 'UNKNOWN_DIRECTION' },
      ]);
    }
    await this.#assertCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    if (listingId !== undefined && listingId !== null) {
      await this.#listingService.getListing(principal, listingId);
    }

    const exportToken =
      direction === 'EXPORT' || direction === 'BOTH'
        ? randomBytes(24).toString('hex')
        : null;

    const created = await this.#inventoryConnectionRepository.create({
      partnerId,
      listingId: listingId ?? null,
      connectorType,
      direction,
      name,
      config: config ?? {},
      exportToken,
      createdBy: principal.userId,
    });
    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'inventory_connection.created',
      targetType: 'inventory_connection',
      targetId: created.id,
      afterSnapshot: { partnerId, listingId, connectorType, direction, name },
    });
    return created;
  }

  async updateConnection(principal, id, fields) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      id,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    const updated = await this.#inventoryConnectionRepository.update(
      connection.id,
      fields,
    );
    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'inventory_connection.updated',
      targetType: 'inventory_connection',
      targetId: id,
    });
    return updated;
  }

  async disconnectConnection(principal, id) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      id,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    await this.#inventoryConnectionRepository.softDelete(connection.id);
    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'inventory_connection.disconnected',
      targetType: 'inventory_connection',
      targetId: id,
    });
  }

  async listConnections(principal, partnerId) {
    await this.#assertCapability(
      principal,
      partnerId,
      PARTNER_CAPABILITIES.VIEW_SYNC_LOGS,
      'inventory.view_all',
    );
    return this.#inventoryConnectionRepository.listForPartner(partnerId);
  }

  async getConnection(principal, id) {
    return this.#loadConnectionForCapability(
      principal,
      id,
      PARTNER_CAPABILITIES.VIEW_SYNC_LOGS,
      'inventory.view_all',
    );
  }

  async setMapping(
    principal,
    connectionId,
    { externalResourceId, externalResourceName, bookableUnitId },
  ) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      connectionId,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    const unit = await this.#bookableUnitService.findById(bookableUnitId);
    if (!unit) throw new NotFoundError('Bookable unit not found.');
    return this.#inventoryConnectionRepository.upsertMapping({
      connectionId: connection.id,
      externalResourceId: externalResourceId ?? DEFAULT_MAPPING_KEY,
      externalResourceName,
      bookableUnitId: unit.id,
    });
  }

  async testConnection(principal, id) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      id,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    const connector = this.#registry.resolve(connection.connectorType);
    try {
      return await connector.testConnection(connection);
    } catch (err) {
      return { ok: false, message: err.message ?? 'Connection test failed.' };
    }
  }

  /**
   * Runs one sync (spec §23-25): fetches/parses via the resolved
   * connector, applies every event through `AvailabilityService`'s
   * system-level capacity methods inside one transaction, records an
   * `inventory_sync_runs` row either way, and never leaves the
   * connection silently claiming "Connected" if the sync failed (spec
   * §27: "Do not falsely show 'Connected' merely because credentials/
   * configuration were saved").
   */
  async syncNow(principal, id, { triggerCode = 'MANUAL' } = {}) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      id,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    return this.#executeSync(connection, {
      triggerCode,
      actorId: principal.userId,
    });
  }

  /**
   * Trusted-caller-only, system-level sweep: syncs every non-disconnected
   * connection, sequentially (never concurrent — connections share the
   * same underlying MySQL pool and this runs unattended, so a slow/
   * failing connector must not starve the others of connections). One
   * failure never aborts the sweep: `#executeSync` already catches and
   * records a FAILED run per connection. No `principal`, no RBAC check,
   * never an HTTP route (mirrors `AvailabilityService#applySystem
   * ExternalReservation`'s "system-level" precedent) — the scheduled
   * reconciliation job (`jobs/inventoryReconciliationSweep.js`) is the
   * only caller: a background job isn't a fresh per-request user action,
   * so it has no `principal` to authorize against.
   */
  async syncAllActiveConnections({ triggerCode = 'SCHEDULED' } = {}) {
    const connections =
      await this.#inventoryConnectionRepository.listAllActive();
    const results = [];
    for (const connection of connections) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design, see method doc.
      const run = await this.#executeSync(connection, {
        triggerCode,
        actorId: null,
      }).catch((err) => ({ status: 'FAILED', errorMessage: err.message }));
      results.push({ connectionId: connection.id, ...run });
    }
    return results;
  }

  async #executeSync(connection, { triggerCode, actorId }) {
    const connector = this.#registry.resolve(connection.connectorType);
    const attemptedAt = new Date();
    await this.#inventoryConnectionRepository.update(connection.id, {
      lastAttemptedSyncAt: attemptedAt,
    });

    const syncRun = await this.#inventoryConnectionRepository.createSyncRun({
      connectionId: connection.id,
      direction: connection.direction,
      triggerCode,
    });

    try {
      const mappings = await this.#inventoryConnectionRepository.listMappings(
        connection.id,
      );
      const mappingByKey = Object.fromEntries(
        mappings.map((m) => [m.externalResourceId, m.bookableUnitId]),
      );
      const previouslyImported =
        await this.#externalReservationRepository.listActiveForConnection(
          connection.id,
        );

      const result = await withTransaction((dbConnection) =>
        connector.importAvailability({
          connectionRecord: connection,
          resolveUnitId: (key) => mappingByKey[key],
          applyReservation: (event, unitId) =>
            this.#availabilityService.applySystemExternalReservation(
              {
                unitId,
                dateFrom: event.dateFrom,
                dateTo: event.dateTo,
                quantity: 1,
                connectionId: connection.id,
                externalEventUid: event.uid,
                externalReference: event.summary,
              },
              dbConnection,
            ),
          cancelReservation: async (externalEventUid) => {
            const reservation =
              await this.#externalReservationRepository.findByConnectionAndUid(
                connection.id,
                externalEventUid,
                dbConnection,
              );
            if (reservation) {
              await this.#availabilityService.cancelSystemExternalReservation(
                reservation.id,
                dbConnection,
              );
            }
          },
          previouslyImportedUids: previouslyImported.map(
            (r) => r.externalEventUid,
          ),
        }),
      );

      for (const conflict of result.conflicts) {
        // eslint-disable-next-line no-await-in-loop
        await this.#inventoryConnectionRepository.createConflict({
          syncRunId: syncRun.id,
          connectionId: connection.id,
          externalEventUid: conflict.externalEventUid,
          conflictType: conflict.conflictType,
          details: conflict.details,
        });
      }

      const finalStatus = result.conflicts.length > 0 ? 'PARTIAL' : 'SUCCESS';
      const finishedRun =
        await this.#inventoryConnectionRepository.finishSyncRun(syncRun.id, {
          status: finalStatus,
          recordsReceived: result.recordsReceived,
          recordsCreated: result.recordsCreated,
          recordsUpdated: result.recordsUpdated,
          recordsSkipped: result.recordsSkipped,
          conflictsCount: result.conflicts.length,
        });
      await this.#inventoryConnectionRepository.update(connection.id, {
        lastSuccessfulSyncAt: new Date(),
        lastError: null,
        status: 'ACTIVE',
      });

      await this.#eventBus.publish(
        createDomainEvent({
          eventType:
            result.conflicts.length > 0
              ? EVENT_TYPES.INVENTORY_SYNC_CONFLICT
              : EVENT_TYPES.INVENTORY_SYNC_COMPLETED,
          actorId,
          resourceType: 'inventory_connection',
          resourceId: connection.id,
          payload: {
            partnerId: connection.partnerId,
            connectionName: connection.name,
            syncRunId: syncRun.id,
            ...result,
          },
        }),
      );
      return finishedRun;
    } catch (err) {
      const message = err.message ?? 'Sync failed.';
      const failedRun = await this.#inventoryConnectionRepository.finishSyncRun(
        syncRun.id,
        {
          status: 'FAILED',
          errorMessage: message,
        },
      );
      await this.#inventoryConnectionRepository.update(connection.id, {
        status: 'ERROR',
        lastError: message,
      });
      await this.#eventBus.publish(
        createDomainEvent({
          eventType: EVENT_TYPES.INVENTORY_SYNC_FAILED,
          actorId,
          resourceType: 'inventory_connection',
          resourceId: connection.id,
          payload: {
            partnerId: connection.partnerId,
            connectionName: connection.name,
            error: message,
          },
        }),
      );
      return failedRun;
    }
  }

  async listSyncRuns(principal, connectionId) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      connectionId,
      PARTNER_CAPABILITIES.VIEW_SYNC_LOGS,
      'inventory.view_all',
    );
    return this.#inventoryConnectionRepository.listSyncRunsForConnection(
      connection.id,
    );
  }

  async listSyncConflicts(principal, connectionId) {
    const connection = await this.#loadConnectionForCapability(
      principal,
      connectionId,
      PARTNER_CAPABILITIES.VIEW_SYNC_LOGS,
      'inventory.view_all',
    );
    return this.#inventoryConnectionRepository.listUnresolvedForConnection(
      connection.id,
    );
  }

  async resolveConflict(
    principal,
    connectionId,
    conflictId,
    { resolutionNote } = {},
  ) {
    await this.#loadConnectionForCapability(
      principal,
      connectionId,
      PARTNER_CAPABILITIES.MANAGE_CONNECTIONS,
      'inventory.manage_all',
    );
    await this.#inventoryConnectionRepository.resolveConflict(conflictId, {
      resolvedBy: principal.userId,
      resolutionNote,
    });
    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'inventory_sync_conflict.resolved',
      targetType: 'inventory_sync_conflict',
      targetId: conflictId,
    });
  }

  /**
   * Public, unauthenticated, opaque-token-gated iCal export feed (spec
   * §20) — never exposes guest names/contact details, only occupied
   * date ranges, regardless of what `external_reservations`/`bookings`
   * carry internally.
   */
  async getExportFeed(token) {
    const connection =
      await this.#inventoryConnectionRepository.findByExportToken(token);
    if (!connection || connection.status === 'DISCONNECTED') {
      throw new NotFoundError('Export feed not found.');
    }
    const mappings = await this.#inventoryConnectionRepository.listMappings(
      connection.id,
    );
    const unitIds =
      mappings.length > 0
        ? mappings.map((m) => m.bookableUnitId)
        : (
            await this.#bookableUnitService.listUnitsForListing(
              connection.listingId,
            )
          ).map((u) => u.id);

    const ranges = [];
    for (const unitId of unitIds) {
      const externalReservations =
        // eslint-disable-next-line no-await-in-loop -- small, bounded per-connection unit count.
        await this.#externalReservationRepository.listActiveForUnit(unitId, {
          from: '1970-01-01',
          to: '2100-01-01',
        });
      externalReservations.forEach((r) =>
        ranges.push({
          dateFrom: r.dateFrom,
          dateTo: r.dateTo,
          reference: `res-${r.id}`,
        }),
      );
    }

    return buildIcsExport({
      calendarName: connection.name,
      occupiedRanges: ranges,
    });
  }
}

export default InventoryConnectionService;
