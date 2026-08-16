/**
 * KNOWN LIMITATION: same class of gap `listings/constants/languageIds.js`
 * already documents — no `GET /currencies` reference-data endpoint exists,
 * but `PATCH /users/:id`'s `preferredCurrencyId` is a real numeric FK the
 * frontend has no other way to resolve from an ISO code (unlike
 * `pricingSchema`, which takes `currencyCode` directly — see
 * `listings/constants/currencies.js`'s own comment on that distinction).
 * Hardcodes the ids `apps/api/src/infrastructure/database/seeds/
 * 002_reference_data.js` produces on a freshly-migrated database (AMD,
 * USD, EUR inserted in that fixed order, auto-increment 1/2/3). Breaks
 * silently if `currencies` is ever seeded in a different order — flagged
 * here rather than assumed invisibly. A real fix is a small
 * `GET /currencies` endpoint plus a `useCurrenciesQuery` hook.
 */

export const CURRENCY_ID_BY_CODE = {
  AMD: 1,
  USD: 2,
  EUR: 3,
};

export default CURRENCY_ID_BY_CODE;
