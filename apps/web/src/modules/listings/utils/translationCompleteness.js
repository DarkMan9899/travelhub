/**
 * computeTranslationCompleteness — 2026 Partner Workspace redesign
 * (Sprint 3 closeout): the Review & Publish step's per-locale
 * TRANSLATION completeness, distinct from `useListingCompletenessQuery`'s
 * server-computed REQUIRED-publish completeness (`ListingCompletenessWidget`)
 * — this never gates publishing, it only tells a partner what they've
 * actually authored per locale.
 *
 * Reads straight from the same `listing` object `ReviewStep` already has
 * (`translations`/`highlights`/`itinerary_steps`/`included_items`/`faqs`,
 * each row tagged `language_code`) — no new query, no fallback: a locale
 * with nothing stored for a field counts as missing that field, exactly
 * like the Content step's own authoring view (`getLocalizedItemsExact`),
 * never "borrowed" from another locale.
 *
 * The field checklist is fixed and explicit — 7 checks, chosen to match
 * the fields the Wizard's Basic Info + Content steps actually let a
 * partner author per locale: title, summary, description, highlights,
 * included/excluded items, FAQs, itinerary. A locale is:
 *   - 'complete' — every one of the 7 checks has real content
 *   - 'missing'  — none of the 7 checks have any content
 *   - 'partial'  — anything in between
 * No cross-locale/global percentage is computed — only this real,
 * explicit per-locale fraction (`presentCount / TOTAL_FIELDS`).
 */

const TOTAL_FIELDS = 7;

function hasTranslationField(listing, locale, field) {
  const row = (listing.translations ?? []).find(
    (t) => t.language_code === locale,
  );
  return Boolean(row?.[field]?.trim());
}

function hasAnyForLocale(items, locale) {
  return (items ?? []).some((item) => item.language_code === locale);
}

function computeTranslationCompleteness(listing, locale) {
  const checks = {
    title: hasTranslationField(listing, locale, 'title'),
    summary: hasTranslationField(listing, locale, 'summary'),
    description: hasTranslationField(listing, locale, 'description'),
    highlights: hasAnyForLocale(listing.highlights, locale),
    includedItems: hasAnyForLocale(listing.included_items, locale),
    faqs: hasAnyForLocale(listing.faqs, locale),
    itinerary: hasAnyForLocale(listing.itinerary_steps, locale),
  };

  const presentCount = Object.values(checks).filter(Boolean).length;

  let status = 'partial';
  if (presentCount === 0) status = 'missing';
  else if (presentCount === TOTAL_FIELDS) status = 'complete';

  return { status, presentCount, totalFields: TOTAL_FIELDS, checks };
}

export default computeTranslationCompleteness;
export { TOTAL_FIELDS };
