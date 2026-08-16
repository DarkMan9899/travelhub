/**
 * ListingFaqSection — Phase 18 (Premium Listing Detail): renders a
 * listing's partner-authored `faqs` (migration 0026, `listing_faqs`) as
 * the shared `FaqAccordion` primitive. Never silently publishes
 * AI-hallucinated facts — content here is always exactly what a partner
 * wrote, nothing generated. Renders nothing when a partner hasn't added
 * any FAQs.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { FaqAccordion } from '@travelhub/ui/components/data-display';
import { Section } from '@travelhub/ui/components/layout';

export default function ListingFaqSection({
  faqs = [],
  sectionId = undefined,
}) {
  const { t } = useTranslation();

  if (!faqs || faqs.length === 0) return null;

  return (
    <Section spacing="none" aria-label={t('pages.listingDetail.faq.heading')}>
      <h2 id={sectionId}>{t('pages.listingDetail.faq.heading')}</h2>
      <FaqAccordion items={faqs} />
    </Section>
  );
}

ListingFaqSection.propTypes = {
  faqs: PropTypes.arrayOf(
    PropTypes.shape({
      question: PropTypes.string.isRequired,
      answer: PropTypes.string.isRequired,
    }),
  ),
  sectionId: PropTypes.string,
};
