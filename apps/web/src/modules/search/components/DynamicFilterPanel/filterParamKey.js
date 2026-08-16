/**
 * Resolves a `GET /search/filters` definition to the exact `GET /search`
 * query param key(s) it writes/reads — the one place that encodes the
 * backend's naming convention (`apps/api/.../mysqlSearchRepository.js`'s
 * header comment): `AMENITY`-sourced filters always use the fixed
 * `amenityIds` key; everything else uses `attr_{code}`, with `RANGE`
 * emitting both `_min`/`_max` and `STEPPER` emitting only `_min` (an "N or
 * more" filter) — `SINGLE_SELECT`/`MULTI_SELECT` write the bare key
 * (comma-joined option ids for multi-select).
 *
 * @param {{ code: string, input_type: string, value_source: string }} definition
 * @returns {{ type: 'exact' } & { key: string } | { type: 'range' } & { minKey: string, maxKey: string|undefined }}
 */
export function getFilterParamKey(definition) {
  if (definition.value_source === 'AMENITY') {
    return { type: 'exact', key: 'amenityIds' };
  }

  const base = `attr_${definition.code}`;
  if (definition.input_type === 'RANGE') {
    return { type: 'range', minKey: `${base}_min`, maxKey: `${base}_max` };
  }
  if (definition.input_type === 'STEPPER') {
    return { type: 'range', minKey: `${base}_min`, maxKey: undefined };
  }
  return { type: 'exact', key: base };
}

export default getFilterParamKey;
