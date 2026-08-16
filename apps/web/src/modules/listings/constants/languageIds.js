/**
 * KNOWN LIMITATION: no `GET /languages` reference-data endpoint exists
 * anywhere in the backend, and adding one is out of this phase's scope
 * — but `createListing`/`updateListing`'s `translations[].languageId`
 * is a real numeric FK the frontend has no other way to resolve from a
 * locale code. This hardcodes the ids the seed
 * (`apps/api/src/infrastructure/database/seeds/002_reference_data.js`)
 * produces on a freshly-migrated database, inserting `en`, `hy`, `ru` in
 * that fixed order via auto-increment (1, 2, 3). It silently breaks if
 * the `languages` table is ever seeded in a different order or from a
 * non-empty table — flagged here rather than assumed invisibly. A real
 * fix is a small `GET /languages` endpoint plus a
 * `useLanguagesQuery` hook resolving this dynamically.
 */

export const LANGUAGE_ID_BY_LOCALE = {
  en: 1,
  hy: 2,
  ru: 3,
};

export default LANGUAGE_ID_BY_LOCALE;
