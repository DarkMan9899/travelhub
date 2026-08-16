/**
 * Language-code lookup — shared/cross-module, like `currencyRepository.js`'s
 * single-function precedent: no module owns the `languages` reference
 * table. `resolveLocaleIds` mirrors `mysqlSearchRepository.resolveLocaleIds`
 * exactly (requested locale, falling back to the server's default
 * language) so any module needing locale-aware text (search categories,
 * listing metadata's amenity names) resolves it the same way, without
 * depending on the Search module's own repository class.
 */

import { getMysqlPool } from '../mysqlPool.js';

/**
 * @param {string|undefined} requestedCode - e.g. 'hy'
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} [connection]
 * @returns {Promise<{localeId: number|null, defaultLocaleId: number|null}>}
 */
export async function resolveLocaleIds(
  requestedCode,
  connection = getMysqlPool(),
) {
  const [[defaultLanguage]] = await connection.query(
    'SELECT id FROM languages WHERE is_default = 1 LIMIT 1',
  );
  const defaultLocaleId = defaultLanguage?.id ?? null;

  if (!requestedCode) {
    return { localeId: defaultLocaleId, defaultLocaleId };
  }

  const [[requestedLanguage]] = await connection.query(
    'SELECT id FROM languages WHERE code = ? LIMIT 1',
    [requestedCode],
  );
  return {
    localeId: requestedLanguage?.id ?? defaultLocaleId,
    defaultLocaleId,
  };
}

export default { resolveLocaleIds };
