/**
 * Currency-code lookup — shared/cross-module, like
 * `partnerEmployeeRepository.js`'s single-function precedent: no module
 * owns the `currencies` reference table, and Sprint 10 is the first
 * sprint that needs to resolve a client-supplied currency code
 * (`availability_calendar.price_override_currency_id`,
 * `bookings.currency_id`) into its id. A single narrow function rather
 * than a full port/adapter pair, same rationale as that file's.
 */

import { getMysqlPool } from '../mysqlPool.js';

/**
 * @param {string} code - ISO 4217 code, e.g. 'AMD'
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} [connection]
 * @returns {Promise<{id: number, code: string, decimalPlaces: number}|null>}
 */
export async function findCurrencyByCode(code, connection = getMysqlPool()) {
  const [rows] = await connection.query(
    'SELECT id, code, decimal_places FROM currencies WHERE code = ? LIMIT 1',
    [code],
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    code: rows[0].code,
    decimalPlaces: rows[0].decimal_places,
  };
}

/** @returns {Promise<{code: string, decimalPlaces: number}|null>} */
export async function findCurrencyById(id, connection = getMysqlPool()) {
  const [rows] = await connection.query(
    'SELECT code, decimal_places FROM currencies WHERE id = ? LIMIT 1',
    [id],
  );
  if (!rows[0]) return null;
  return { code: rows[0].code, decimalPlaces: rows[0].decimal_places };
}

export default { findCurrencyByCode, findCurrencyById };
