/**
 * ListingAttributesSection — the read side of `DynamicAttributesStep`'s
 * category-driven attribute set. Reuses `fromAttributeValuesResponse`
 * (Phase 5's own wizard mapping utility, unmodified) to turn the
 * listing's wire-shape `attribute_values` into the same `{code:
 * domainValue}` map `MetadataFieldRenderer` renders from, then hands it
 * to `MetadataValueDisplay` for the actual label+value formatting.
 * Never branches on category — `metadata.attributes` is whatever the
 * category declares, nothing here names one.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Section } from '@desavii/ui/components/layout';
import { fromAttributeValuesResponse } from '../../../utils/attributeValueMapping.js';
import MetadataValueDisplay from '../MetadataValueDisplay.jsx';

export default function ListingAttributesSection({
  attributes = [],
  listing,
  sectionId = undefined,
}) {
  const { t } = useTranslation();

  if (!attributes || attributes.length === 0) return null;

  const valuesByCode = fromAttributeValuesResponse(
    attributes,
    listing.attribute_values,
  );
  const hasAnyValue = attributes.some((definition) => {
    const value = valuesByCode[definition.code];
    return (
      value !== undefined &&
      value !== null &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0)
    );
  });
  if (!hasAnyValue) return null;

  return (
    <Section
      spacing="none"
      aria-label={t('pages.listingDetail.attributes.heading')}
    >
      <h2 id={sectionId}>{t('pages.listingDetail.attributes.heading')}</h2>
      <MetadataValueDisplay
        namespace="attributes"
        definitions={attributes}
        valuesByCode={valuesByCode}
      />
    </Section>
  );
}

const optionShape = PropTypes.shape({
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  code: PropTypes.string.isRequired,
});

ListingAttributesSection.propTypes = {
  attributes: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      data_type: PropTypes.string.isRequired,
      unit: PropTypes.string,
      options: PropTypes.arrayOf(optionShape),
    }),
  ),
  listing: PropTypes.shape({
    // eslint-disable-next-line react/forbid-prop-types -- passthrough to fromAttributeValuesResponse, whose own entry shape varies by data_type
    attribute_values: PropTypes.array,
  }).isRequired,
  sectionId: PropTypes.string,
};
