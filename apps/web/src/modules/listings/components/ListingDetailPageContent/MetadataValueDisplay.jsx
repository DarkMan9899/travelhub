/**
 * MetadataValueDisplay — the read-only counterpart to `PartnerListingWizard/
 * MetadataFieldRenderer.jsx`: given a category's metadata `definitions`
 * (attributes or policies, `GET /listings/metadata`'s shape) and an
 * already-mapped `valuesByCode` domain-value map (built by the *existing*
 * `fromAttributeValuesResponse`/`fromPolicyValuesResponse` — reused
 * as-is, never re-derived here), renders one label+value row per
 * definition the listing actually has a value for. Same `data_type`
 * dispatch, same i18n key convention (`partner.listingWizard.
 * {namespace}.{code}` for labels, `partner.listingWizard.options.
 * {code}.{optionCode}` for ENUM/MULTI_ENUM option labels,
 * `partner.listingWizard.units.{unit}` for number suffixes) as the
 * write-side renderer — this is deliberately a sibling, not a
 * modification, of that file, since the write side keeps owning
 * editable-control concerns (min/max, required, onChange) this read-only
 * version has no use for.
 *
 * A definition the listing has no value for (visible in the category's
 * metadata but never filled in by the partner) is skipped — this section
 * lists what the listing DOES say, not every field a listing of this
 * category COULD have.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Stack } from '@travelhub/ui/components/layout';

const NUMERIC_DATA_TYPES = ['INTEGER', 'DECIMAL'];

/**
 * Pure formatting logic, extracted so `ListingPoliciesSection`'s
 * `PolicyList` cards (Phase 18) can format the exact same domain value
 * this `<dl>` renderer does, without a second implementation of the
 * BOOLEAN/ENUM/MULTI_ENUM/numeric-unit dispatch.
 */
export function formatMetadataValue(definition, value, t) {
  const resolveOptionLabel = (attributeCode, optionCode) =>
    t(`partner.listingWizard.options.${attributeCode}.${optionCode}`, {
      defaultValue: optionCode,
    });

  if (definition.data_type === 'BOOLEAN') {
    return value ? t('pages.listingDetail.yes') : t('pages.listingDetail.no');
  }
  if (definition.data_type === 'MULTI_ENUM') {
    return (value ?? [])
      .map((optionCode) => resolveOptionLabel(definition.code, optionCode))
      .join(', ');
  }
  if (definition.data_type === 'ENUM') {
    return resolveOptionLabel(definition.code, value);
  }
  if (NUMERIC_DATA_TYPES.includes(definition.data_type) && definition.unit) {
    const unitLabel = t(`partner.listingWizard.units.${definition.unit}`, {
      count: value,
      defaultValue: definition.unit,
    });
    return `${value} ${unitLabel}`;
  }
  return String(value);
}

export default function MetadataValueDisplay({
  namespace,
  definitions,
  valuesByCode,
}) {
  const { t } = useTranslation();

  const rows = definitions
    .map((definition) => ({
      definition,
      value: valuesByCode[definition.code],
    }))
    .filter(
      ({ value }) =>
        value !== undefined &&
        value !== null &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0),
    );

  if (rows.length === 0) return null;

  return (
    <Stack gap="2" as="dl">
      {rows.map(({ definition, value }) => (
        <div key={definition.code}>
          <dt>
            {t(`partner.listingWizard.${namespace}.${definition.code}`, {
              defaultValue: definition.code,
            })}
          </dt>
          <dd>{formatMetadataValue(definition, value, t)}</dd>
        </div>
      ))}
    </Stack>
  );
}

const optionShape = PropTypes.shape({
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  code: PropTypes.string.isRequired,
});

MetadataValueDisplay.propTypes = {
  namespace: PropTypes.oneOf(['attributes', 'policies']).isRequired,
  definitions: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      data_type: PropTypes.string.isRequired,
      unit: PropTypes.string,
      options: PropTypes.arrayOf(optionShape),
    }),
  ).isRequired,
  // eslint-disable-next-line react/forbid-prop-types -- domain value shape varies by data_type (string/number/boolean/array), same as MetadataFieldRenderer's own `value` prop
  valuesByCode: PropTypes.object.isRequired,
};
