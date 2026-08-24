/**
 * Bed-type vocabulary for `bookable_units.bed_configuration` (P2.2A).
 * A small, code-owned closed set — mirrors `bookableUnitTypes.js`'s own
 * precedent (a fixed backend enum, reused by the Zod validator rather
 * than re-declared) and migration 0025's "small closed vocabularies don't
 * need a lookup table" judgment, applied here inside a JSON array's
 * `type` field instead of a literal VARCHAR column.
 */

export const BED_TYPES = Object.freeze([
  'SINGLE',
  'DOUBLE',
  'QUEEN',
  'KING',
  'TWIN',
  'SOFA_BED',
  'BUNK',
]);

export default { BED_TYPES };
