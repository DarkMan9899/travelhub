/**
 * Picks a listing's translation for the active locale, falling back to
 * the first available translation (never a raw key, never blank) —
 * mirrors the fallback rule FRONTEND_ARCHITECTURE.md §16.4 documents for
 * i18next keys, applied here to API-supplied translation rows instead of
 * translation-file keys.
 *
 * Each translation row now carries `language_code` (Phase 6 — `listingDto.
 * js`'s `toTranslationResponse`, joined from the `languages` table), so a
 * direct locale match is possible; earlier phases could only return
 * `translations[0]` since no row exposed which language it was in.
 */
function getLocalizedTranslation(translations, locale) {
  if (!Array.isArray(translations) || translations.length === 0) {
    return null;
  }
  if (locale) {
    const match = translations.find(
      (translation) => translation.language_code === locale,
    );
    if (match) return match;
  }
  return translations[0];
}

export default getLocalizedTranslation;
