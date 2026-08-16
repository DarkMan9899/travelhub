/**
 * Converts between `MetadataFieldRenderer`'s per-field domain value and
 * the wire shape `policyValues` expects — always `{ code, value: string
 * }` (`listingValidators.js`'s `policyValueSchema`), unlike attributes'
 * `optionCodes` array convention: `listingService.js`'s
 * `#resolvePolicyValues` looks up an ENUM policy's option by `entry.value`
 * directly (a bare code string, never wrapped in an array), and there's
 * no schema support for a policy MULTI_ENUM at all (`policyValueSchema`
 * only ever accepts one string) — so this mapping only ever needs to
 * handle BOOLEAN/ENUM/STRING, the only data types
 * `seeds/007_pricing_and_policies.js` actually declares for policies.
 *
 * Lives in `modules/listings/utils/` (moved out of `PartnerListingWizard/`
 * in Phase 6) since `fromPolicyValuesResponse` is now shared by both the
 * wizard (write side) and `ListingPoliciesSection` (Listing Details' read
 * side) — see `attributeValueMapping.js`'s header for the same rationale.
 */

export function toPolicyValuesPayload(definitions, values) {
  return definitions
    .filter((definition) => {
      const value = values[definition.code];
      return value !== undefined && value !== null && value !== '';
    })
    .map((definition) => {
      const value = values[definition.code];
      if (definition.data_type === 'BOOLEAN') {
        return { code: definition.code, value: value ? 'true' : 'false' };
      }
      return { code: definition.code, value: String(value) };
    });
}

export function fromPolicyValuesResponse(definitions, policyValues) {
  const byCode = new Map(
    (policyValues ?? []).map((entry) => [entry.code, entry]),
  );
  const result = {};
  definitions.forEach((definition) => {
    const entry = byCode.get(definition.code);
    if (!entry) return;
    if (definition.data_type === 'BOOLEAN') {
      result[definition.code] = entry.value === 'true';
    } else {
      result[definition.code] = entry.value;
    }
  });
  return result;
}
