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

/**
 * The reverse of `resolveLocaleIds` — P0.3 (Master Roadmap): resolves a
 * stored `users.preferred_language_id` into the locale code
 * `emailTemplates.js` selects a template with. Falls back to the
 * server's default language (never throws) so a user with no preference
 * set, or a since-deleted language row, still gets a real email rather
 * than a lookup failure blocking delivery.
 * @param {number|null} languageId
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} [connection]
 * @returns {Promise<string>} a locale code, e.g. 'en'
 */
export async function findLanguageCodeById(
  languageId,
  connection = getMysqlPool(),
) {
  if (languageId) {
    const [[language]] = await connection.query(
      'SELECT code FROM languages WHERE id = ? LIMIT 1',
      [languageId],
    );
    if (language?.code) return language.code;
  }
  const [[defaultLanguage]] = await connection.query(
    'SELECT code FROM languages WHERE is_default = 1 LIMIT 1',
  );
  return defaultLanguage?.code ?? 'en';
}

export default { resolveLocaleIds, findLanguageCodeById };
