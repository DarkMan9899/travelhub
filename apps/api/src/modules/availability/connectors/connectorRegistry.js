/**
 * ConnectorRegistry — `code -> InventoryConnector instance` lookup
 * (Phase 17 §15), mirroring `modules/payments/providers/
 * paymentProviderRegistry.js`'s exact shape. `InventoryConnectionService`
 * resolves a connector by `connectorType` and never imports a concrete
 * class — adding `CsvConnector`/a future PMS connector is a one-line
 * addition here, never a change to the Service.
 */

export class ConnectorRegistry {
  #connectorsByCode = new Map();

  register(connector) {
    this.#connectorsByCode.set(connector.code, connector);
    return this;
  }

  resolve(code) {
    const connector = this.#connectorsByCode.get(code);
    if (!connector) {
      throw new Error(`No inventory connector registered for code "${code}".`);
    }
    return connector;
  }

  has(code) {
    return this.#connectorsByCode.has(code);
  }
}

export default ConnectorRegistry;
