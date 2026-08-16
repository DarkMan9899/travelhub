/**
 * InventoryConnector — the port every external synchronization channel
 * implements (Phase 17 §15). Mirrors this codebase's own
 * `modules/payments/providers/PaymentProvider.js` precedent exactly:
 * an abstract base whose methods throw "not implemented" by default, one
 * concrete subclass per real channel, and a registry
 * (`connectorRegistry.js`) the rest of the app resolves by `code` —
 * `InventoryConnectionService` never imports a concrete connector class
 * directly, so adding a future PMS/Channel-Manager connector never
 * touches the Inventory Engine, Booking, Search, or Checkout (Phase 17
 * §62's explicit acceptance criterion).
 *
 * Every method that touches capacity does so by calling back into
 * `AvailabilityService#applySystemExternalReservation`/
 * `#cancelSystemExternalReservation` (passed in as `applyReservation`/
 * `cancelReservation` callbacks) — a connector never writes to
 * `availability_calendar` itself, the same "adapters normalize; the
 * engine decides" separation the whole platform is built around.
 */

export class InventoryConnector {
  // eslint-disable-next-line class-methods-use-this
  get code() {
    throw new Error('InventoryConnector subclasses must implement `code`.');
  }

  /** Declares which Phase 17 §17 capabilities this connector genuinely has — never assume a capability a connector doesn't declare. */
  // eslint-disable-next-line class-methods-use-this
  get capabilities() {
    return [];
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async testConnection(_connectionRecord) {
    throw new Error('testConnection() not implemented.');
  }

  /**
   * Pulls external occupancy and applies it via `applyReservation`/
   * `cancelReservation`, returning sync statistics.
   * @returns {Promise<{recordsReceived:number, recordsCreated:number, recordsUpdated:number, recordsSkipped:number, conflicts: Array<object>}>}
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  async importAvailability(_context) {
    throw new Error('importAvailability() not implemented.');
  }
}

export default InventoryConnector;
