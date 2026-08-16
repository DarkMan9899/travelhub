/**
 * ListingIncludedSection — Phase 18 (Premium Listing Detail): renders a
 * listing's partner-authored `included_items` (migration 0026,
 * `listing_included_items`) as the shared `IncludedItemsList` primitive
 * (two columns: included / not included). Renders nothing when a partner
 * hasn't filled this in — never fabricates what's included from silence.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { IncludedItemsList } from '@travelhub/ui/components/data-display';
import { Section } from '@travelhub/ui/components/layout';

export default function ListingIncludedSection({
  items = [],
  sectionId = undefined,
}) {
  const { t } = useTranslation();

  if (!items || items.length === 0) return null;

  return (
    <Section
      spacing="none"
      aria-label={t('pages.listingDetail.included.heading')}
    >
      <h2 id={sectionId}>{t('pages.listingDetail.included.heading')}</h2>
      <IncludedItemsList
        items={items}
        includedHeading={t('pages.listingDetail.included.includedHeading')}
        excludedHeading={t('pages.listingDetail.included.excludedHeading')}
      />
    </Section>
  );
}

ListingIncludedSection.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      item_text: PropTypes.string.isRequired,
      is_included: PropTypes.bool.isRequired,
    }),
  ),
  sectionId: PropTypes.string,
};
