/**
 * `currencies` — a fixed, rarely-changing backend enum
 * (`apps/api/src/infrastructure/database/seeds/002_reference_data.js`:
 * "AMD, USD and EUR currencies"). Unlike `languages`, `pricingSchema`'s
 * `currencyCode` takes the ISO code directly (no numeric FK to resolve),
 * so mirroring it here carries none of `languageIds.js`'s fragility —
 * these codes are the real, stable ISO 4217 codes regardless of a given
 * database's row order.
 */

export const CURRENCY_CODES = ['AMD', 'USD', 'EUR'];

export default CURRENCY_CODES;
