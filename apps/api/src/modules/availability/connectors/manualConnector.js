/**
 * ManualConnector — the trivial, always-healthy connector representing
 * "no external system, a human enters everything" (Phase 17 §7's "first-
 * class channel", §15's connector list). Exists mainly so the
 * Connections/Sync Center has one real entry for every partner even
 * before they configure anything external, and so `testConnection`/
 * `importAvailability` have a genuine, uniform implementation rather
 * than a special-cased "if connectorType === MANUAL, skip everything"
 * branch scattered through `InventoryConnectionService`.
 */

import { InventoryConnector } from './InventoryConnector.js';

export class ManualConnector extends InventoryConnector {
  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'MANUAL';
  }

  // eslint-disable-next-line class-methods-use-this
  get capabilities() {
    return ['IMPORT_RESERVATIONS'];
  }

  // eslint-disable-next-line class-methods-use-this
  async testConnection() {
    return { ok: true, message: 'Manual entry — nothing to connect to.' };
  }

  // eslint-disable-next-line class-methods-use-this
  async importAvailability() {
    return {
      recordsReceived: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      recordsSkipped: 0,
      conflicts: [],
    };
  }
}

export default ManualConnector;
