/**
 * IcalConnector — real fetch + parse + idempotent import against an
 * external iCal feed (Airbnb/VRBO/Booking.com-style "export URL")
 * (Phase 17 §19). Per Phase 17 spec §61 ("do not send real reservations
 * to... during this phase", "real provider credentials are NOT
 * required"), this is never live-called against a real third-party URL
 * anywhere in this codebase's tests or demo data — `config.fixtureIcs`
 * (a literal .ics string stored on the connection) is what demo seeding
 * and integration tests use instead of `config.feedUrl` (a real HTTP(S)
 * fetch), so the exact same import/parse/idempotency code path is
 * genuinely exercised without any network dependency. A partner who
 * configures a real `feedUrl` in production gets the real `fetch` path
 * with no code change.
 *
 * One iCal connection maps to exactly one `bookable_unit_id` — the
 * common real-world shape (one export-URL per room type/vehicle) —
 * resolved via a single `inventory_connection_mappings` row keyed
 * `external_resource_id = 'default'`, so a future multi-resource iCal
 * feed only needs additional mapping rows, not a schema/code change.
 */

import { InventoryConnector } from './InventoryConnector.js';
import { parseIcalEvents } from './icalParser.js';
import { ExternalServiceError } from '../../../errors/AppError.js';

const DEFAULT_MAPPING_KEY = 'default';
const FETCH_TIMEOUT_MS = 10_000;

async function fetchIcsText(feedUrl, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(feedUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new ExternalServiceError(
        `iCal feed returned HTTP ${response.status}.`,
      );
    }
    return await response.text();
  } catch (err) {
    if (err instanceof ExternalServiceError) throw err;
    throw new ExternalServiceError('Failed to fetch the iCal feed.');
  } finally {
    clearTimeout(timeout);
  }
}

export class IcalConnector extends InventoryConnector {
  #fetchImpl;

  constructor({ fetchImpl = fetch } = {}) {
    super();
    this.#fetchImpl = fetchImpl;
  }

  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'ICAL';
  }

  // eslint-disable-next-line class-methods-use-this
  get capabilities() {
    return ['IMPORT_AVAILABILITY', 'POLLING', 'ICAL', 'BULK_IMPORT'];
  }

  async #readIcsText(connectionRecord) {
    const { feedUrl, fixtureIcs } = connectionRecord.config ?? {};
    if (fixtureIcs) return fixtureIcs;
    if (!feedUrl) {
      throw new ExternalServiceError(
        'This iCal connection has no feedUrl configured.',
      );
    }
    return fetchIcsText(feedUrl, this.#fetchImpl);
  }

  async testConnection(connectionRecord) {
    const icsText = await this.#readIcsText(connectionRecord);
    const events = parseIcalEvents(icsText);
    return {
      ok: true,
      message: `Feed reachable — ${events.length} event(s) found.`,
    };
  }

  /**
   * @param {object} context
   * @param {object} context.connectionRecord
   * @param {(externalResourceId:string)=>(number|undefined)} context.resolveUnitId
   * @param {(event:object, unitId:number)=>Promise<{created:boolean}>} context.applyReservation
   * @param {(externalEventUid:string)=>Promise<void>} context.cancelReservation
   * @param {string[]} context.previouslyImportedUids - UIDs already imported from this connection, so removed/changed events can be detected (spec §19).
   */
  async importAvailability({
    connectionRecord,
    resolveUnitId,
    applyReservation,
    cancelReservation,
    previouslyImportedUids,
  }) {
    const icsText = await this.#readIcsText(connectionRecord);
    const events = parseIcalEvents(icsText);
    const unitId = resolveUnitId(DEFAULT_MAPPING_KEY);

    const conflicts = [];
    let recordsCreated = 0;
    let recordsSkipped = 0;

    if (!unitId) {
      conflicts.push({
        externalEventUid: null,
        conflictType: 'AMBIGUOUS_MAPPING',
        details: {
          message: 'No bookable unit mapped for this iCal connection.',
        },
      });
      return {
        recordsReceived: events.length,
        recordsCreated: 0,
        recordsUpdated: 0,
        recordsSkipped: events.length,
        conflicts,
      };
    }

    const seenUids = new Set();
    for (const event of events) {
      seenUids.add(event.uid);
      if (event.status === 'CANCELLED') {
        // eslint-disable-next-line no-await-in-loop -- events are applied sequentially within one sync run's transaction.
        await cancelReservation(event.uid);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const result = await applyReservation(event, unitId);
        if (result.created) {
          recordsCreated += 1;
        } else {
          recordsSkipped += 1;
        }
      }
    }

    // Reconciliation (spec §24): a UID we previously imported that's no
    // longer in the feed means the external booking was removed/cancelled
    // upstream — release the capacity it held.
    const removedUids = previouslyImportedUids.filter(
      (uid) => !seenUids.has(uid),
    );
    for (const uid of removedUids) {
      // eslint-disable-next-line no-await-in-loop
      await cancelReservation(uid);
    }

    return {
      recordsReceived: events.length,
      recordsCreated,
      recordsUpdated: 0,
      recordsSkipped,
      conflicts,
    };
  }
}

export default IcalConnector;
