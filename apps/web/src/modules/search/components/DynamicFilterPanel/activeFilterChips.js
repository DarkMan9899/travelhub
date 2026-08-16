/**
 * Derives the "active filter" chip list from the current `dynamicFilters`
 * bag + the category's resolved filter catalog — one chip per filter that
 * currently has a value, each carrying the exact key(s) clearing it
 * requires (a RANGE chip clears both `_min` and `_max` together). Pure,
 * no React, so `DynamicFilterPanel` and its tests can both call it
 * directly.
 */

import { getFilterParamKey } from './filterParamKey.js';

function translateOption(definition, option, t) {
  return definition.value_source === 'AMENITY'
    ? option.code
    : t(`search.dynamicFilters.options.${option.code}`, option.code);
}

export function getActiveFilterChips(groups, dynamicFilters, t) {
  const chips = [];

  groups.forEach((group) => {
    group.definitions.forEach((definition) => {
      const paramKey = getFilterParamKey(definition);
      const label = t(
        `search.dynamicFilters.definitions.${definition.code}`,
        definition.code,
      );

      if (definition.input_type === 'STEPPER') {
        const raw = dynamicFilters[paramKey.minKey];
        if (!raw) return;
        chips.push({
          key: paramKey.minKey,
          keysToClear: [paramKey.minKey],
          label: `${label}: ${raw}+`,
        });
        return;
      }

      if (definition.input_type === 'RANGE') {
        const rawMin = dynamicFilters[paramKey.minKey];
        const rawMax = dynamicFilters[paramKey.maxKey];
        if (!rawMin && !rawMax) return;
        const min = rawMin ?? definition.min;
        const max = rawMax ?? definition.max;
        chips.push({
          key: paramKey.minKey,
          keysToClear: [paramKey.minKey, paramKey.maxKey],
          label: `${label}: ${min}–${max}`,
        });
        return;
      }

      if (definition.input_type === 'SINGLE_SELECT') {
        const raw = dynamicFilters[paramKey.key];
        if (!raw) return;
        const option = definition.options.find(
          (candidate) => String(candidate.value) === raw,
        );
        chips.push({
          key: paramKey.key,
          keysToClear: [paramKey.key],
          label: `${label}: ${option ? translateOption(definition, option, t) : raw}`,
        });
        return;
      }

      if (definition.input_type === 'MULTI_SELECT') {
        const raw = dynamicFilters[paramKey.key];
        if (!raw) return;
        const selectedLabels = raw
          .split(',')
          .map((id) =>
            definition.options.find((option) => String(option.value) === id),
          )
          .filter(Boolean)
          .map((option) => translateOption(definition, option, t));
        if (selectedLabels.length === 0) return;
        chips.push({
          key: paramKey.key,
          keysToClear: [paramKey.key],
          label: `${label}: ${selectedLabels.join(', ')}`,
        });
      }
    });
  });

  return chips;
}

export default getActiveFilterChips;
