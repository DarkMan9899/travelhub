/**
 * Filters a listing's rich-content array (highlights / itinerary steps /
 * included items / FAQs — migration 0037) down to one locale, the same
 * way `getLocalizedTranslation.js` picks one `translations` row: every
 * language's rows come back flat in one array (each tagged with
 * `language_code`), and picking the right subset is a frontend concern
 * rather than four near-identical SQL fallback branches on the backend.
 *
 * Fallback is deterministic and explicit — requested locale, then
 * `DEFAULT_CONTENT_LOCALE` (the platform's configured default language,
 * `languages.is_default = 1` in the database — currently `'en'`, a
 * neutral choice that doesn't privilege any one visitor locale over
 * another), then an empty list. It never mixes items from two locales
 * into one list (that would scramble sort order and item count) and
 * never falls through to a raw/undefined value — an empty array is
 * exactly what every consumer here already treats as "nothing to show".
 */
const DEFAULT_CONTENT_LOCALE = 'en';

function getLocalizedItems(items, locale) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const forLocale = items.filter((item) => item.language_code === locale);
  if (forLocale.length > 0) return forLocale;

  if (locale !== DEFAULT_CONTENT_LOCALE) {
    const forDefault = items.filter(
      (item) => item.language_code === DEFAULT_CONTENT_LOCALE,
    );
    if (forDefault.length > 0) return forDefault;
  }

  return [];
}

/**
 * The strict counterpart `getLocalizedItems` deliberately doesn't provide
 * — 2026 Partner Workspace redesign (Sprint 3): the Wizard's Content step
 * authoring UI must show a partner exactly what is actually stored for
 * the locale they're editing, never another locale's content silently
 * standing in for it. `getLocalizedItems`'s fallback-to-default behavior
 * is correct for a PUBLIC READER (never show a blank section when a
 * translation exists in some locale), but wrong for an AUTHOR (an empty
 * HY editor must look empty, not quietly show EN content that would be
 * saved back as if it were genuinely authored HY text). Same locale
 * filter, zero fallback — an empty array means exactly what it says.
 */
function getLocalizedItemsExact(items, locale) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.filter((item) => item.language_code === locale);
}

export default getLocalizedItems;
export { DEFAULT_CONTENT_LOCALE, getLocalizedItemsExact };
