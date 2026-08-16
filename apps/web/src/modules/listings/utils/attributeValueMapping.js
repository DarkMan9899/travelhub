/**
 * Converts between `MetadataFieldRenderer`'s per-field domain value (see
 * that component's file header — number/boolean/string/ISO-date/option-
 * code/option-codes[]) and the wire shape `attributeValues` expects
 * (`{ code, value }` or `{ code, optionCodes }` — `listingValidators.js`'s
 * `attributeValueSchema`). Both ENUM and MULTI_ENUM use `optionCodes` on
 * the wire (even a single-select ENUM sends a one-element array — see
 * `mysqlListingRepository.js`'s `ENUM_ATTRIBUTE_DATA_TYPES`); only the
 * *domain* value differs (a bare string for ENUM vs. a string array for
 * MULTI_ENUM), which is what `MetadataFieldRenderer` actually renders
 * against.
 *
 * Lives in `modules/listings/utils/` (moved out of `PartnerListingWizard/`
 * in Phase 6) since `fromAttributeValuesResponse` is now shared by both
 * the wizard (write side) and `ListingAttributesSection` (Listing
 * Details' read side) — keeping it wizard-scoped would also have forced
 * an unrelated read-only page's bundle to pull in the whole wizard chunk.
 */

const NUMERIC_DATA_TYPES = ['INTEGER', 'DECIMAL'];

export function toAttributeValuesPayload(definitions, values) {
  return definitions
    .filter((definition) => {
      const value = values[definition.code];
      return value !== undefined && value !== null && value !== '';
    })
    .map((definition) => {
      const value = values[definition.code];
      if (definition.data_type === 'MULTI_ENUM') {
        return { code: definition.code, optionCodes: value };
      }
      if (definition.data_type === 'ENUM') {
        return { code: definition.code, optionCodes: [value] };
      }
      return { code: definition.code, value };
    });
}

export function fromAttributeValuesResponse(definitions, attributeValues) {
  const byCode = new Map(
    (attributeValues ?? []).map((entry) => [entry.code, entry]),
  );
  const result = {};
  definitions.forEach((definition) => {
    const entry = byCode.get(definition.code);
    if (!entry) return;
    if (definition.data_type === 'MULTI_ENUM') {
      result[definition.code] = entry.option_codes ?? [];
    } else if (definition.data_type === 'ENUM') {
      result[definition.code] = entry.option_codes?.[0] ?? null;
    } else if (NUMERIC_DATA_TYPES.includes(definition.data_type)) {
      result[definition.code] =
        entry.value !== undefined ? Number(entry.value) : undefined;
    } else if (definition.data_type === 'BOOLEAN') {
      result[definition.code] = Boolean(Number(entry.value));
    } else {
      result[definition.code] = entry.value;
    }
  });
  return result;
}
