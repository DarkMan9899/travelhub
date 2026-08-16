/**
 * AI feature codes (Phase 15) — a small, fixed, app-level set (like
 * messaging's `REACTION_CODES`), not a DB-driven lookup table: adding a
 * new AI feature is a code change (new prompt module + service method)
 * anyway, so a lookup table would add ceremony without buying anything.
 *
 * Every `ai_conversations.feature_code`/`ai_usage_logs.feature_code`
 * column value must be one of these.
 */
export const FEATURE_CODES = Object.freeze({
  TRIP_PLANNER: 'trip_planner',
  SEARCH_PARSE: 'search_parse',
  ASSISTANT: 'assistant',
  RECOMMENDATIONS: 'recommendations',
  LISTING_DESCRIPTION: 'listing_description',
  LISTING_SEO: 'listing_seo',
  LISTING_TITLE: 'listing_title',
  LISTING_AMENITIES: 'listing_amenities',
  LISTING_TRANSLATE: 'listing_translate',
  LISTING_FAQS: 'listing_faqs',
  MODERATION: 'moderation',
});

export const FEATURE_CODE_VALUES = Object.freeze(Object.values(FEATURE_CODES));
