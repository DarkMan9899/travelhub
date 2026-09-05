/**
 * FilterControl — the `input_type` -> control registry `DynamicFilterPanel`
 * renders each `GET /search/filters` definition through. This is the one
 * place that: resolves a definition's i18n label (definitions/groups are a
 * fixed, backend-declared catalog, so their display strings live in i18n,
 * `search.dynamicFilters.*` — see `modules/search/README.md`), reads the
 * current raw string value(s) out of `dynamicFilters` via
 * `filterParamKey.js`, and turns each control's typed `onChange` back into
 * the string-keyed `patch` `useSearchFilters.updateDynamicFilter` expects.
 *
 * Amenity option labels are the one exception to "translate the code": an
 * amenity's `code` here is literally `listing_amenities.name` (e.g.
 * "WiFi"), which has no i18n table of its own anywhere in the schema yet
 * (a pre-existing limitation, not something this component solves) — so
 * `AMENITY`-sourced options are shown as-is, never passed through `t()`.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ChipGroup } from '@desavii/ui/components/form-controls';
import Stepper from './controls/Stepper.jsx';
import RangeSlider from './controls/RangeSlider.jsx';
import CheckboxGroup from './controls/CheckboxGroup.jsx';
import { getFilterParamKey } from './filterParamKey.js';

function toNumber(raw) {
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export default function FilterControl({
  definition,
  dynamicFilters,
  onChange,
}) {
  const { t } = useTranslation();
  const paramKey = getFilterParamKey(definition);
  const label = t(
    `search.dynamicFilters.definitions.${definition.code}`,
    definition.code,
  );

  const translateOption = (option) =>
    definition.value_source === 'AMENITY'
      ? option.code
      : t(`search.dynamicFilters.options.${option.code}`, option.code);

  if (definition.input_type === 'STEPPER') {
    const value = toNumber(dynamicFilters[paramKey.minKey]);
    return (
      <Stepper
        label={label}
        unit={definition.unit}
        min={definition.min ?? 0}
        max={definition.max ?? undefined}
        value={value}
        onChange={(next) =>
          onChange({
            [paramKey.minKey]: next === undefined ? '' : String(next),
          })
        }
        anyLabel={t('search.dynamicFilters.anyValue')}
        decreaseAriaLabel={t('search.dynamicFilters.decrease', { label })}
        increaseAriaLabel={t('search.dynamicFilters.increase', { label })}
      />
    );
  }

  if (definition.input_type === 'RANGE') {
    const boundsMin = definition.min ?? 0;
    const boundsMax = definition.max ?? 100;
    const valueMin = toNumber(dynamicFilters[paramKey.minKey]) ?? boundsMin;
    const valueMax = toNumber(dynamicFilters[paramKey.maxKey]) ?? boundsMax;
    return (
      <RangeSlider
        label={label}
        unit={definition.unit}
        min={boundsMin}
        max={boundsMax}
        valueMin={valueMin}
        valueMax={valueMax}
        onChange={(nextMin, nextMax) =>
          onChange({
            [paramKey.minKey]: nextMin === boundsMin ? '' : String(nextMin),
            [paramKey.maxKey]: nextMax === boundsMax ? '' : String(nextMax),
          })
        }
        minAriaLabel={t('search.dynamicFilters.minValue', { label })}
        maxAriaLabel={t('search.dynamicFilters.maxValue', { label })}
      />
    );
  }

  if (definition.input_type === 'SINGLE_SELECT') {
    const selectedValue = dynamicFilters[paramKey.key];
    return (
      <ChipGroup
        label={label}
        options={definition.options.map((option) => ({
          value: String(option.value),
          label: translateOption(option),
        }))}
        selectedValue={selectedValue}
        onChange={(next) => onChange({ [paramKey.key]: next ?? '' })}
      />
    );
  }

  if (definition.input_type === 'MULTI_SELECT') {
    const raw = dynamicFilters[paramKey.key];
    const selectedValues = raw ? raw.split(',') : [];
    return (
      <CheckboxGroup
        label={label}
        options={definition.options.map((option) => ({
          value: String(option.value),
          label: translateOption(option),
        }))}
        selectedValues={selectedValues}
        onChange={(next) => onChange({ [paramKey.key]: next.join(',') })}
      />
    );
  }

  return null;
}

FilterControl.propTypes = {
  definition: PropTypes.shape({
    code: PropTypes.string.isRequired,
    input_type: PropTypes.string.isRequired,
    value_source: PropTypes.string.isRequired,
    unit: PropTypes.string,
    min: PropTypes.number,
    max: PropTypes.number,
    options: PropTypes.arrayOf(
      PropTypes.shape({
        value: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
          .isRequired,
        code: PropTypes.string.isRequired,
      }),
    ).isRequired,
  }).isRequired,
  dynamicFilters: PropTypes.objectOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
};
