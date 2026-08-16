/**
 * ListingItinerarySection — Phase 18 (Premium Listing Detail): renders a
 * listing's partner-authored `itinerary_steps` (migration 0026,
 * `listing_itinerary_steps`) as the shared `Timeline` primitive. Only
 * ever present for a listing type where a partner has actually filled it
 * in (Tours/Activities, typically) — a listing with no steps renders
 * nothing, never a fabricated placeholder itinerary.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Timeline } from '@travelhub/ui/components/data-display';
import { Section } from '@travelhub/ui/components/layout';

export default function ListingItinerarySection({
  steps = [],
  sectionId = undefined,
}) {
  const { t } = useTranslation();

  if (!steps || steps.length === 0) return null;

  const timelineSteps = steps.map((step) => ({
    title: step.title,
    description: step.description ?? undefined,
    durationMinutes: step.duration_minutes ?? undefined,
  }));

  return (
    <Section
      spacing="none"
      aria-label={t('pages.listingDetail.itinerary.heading')}
    >
      <h2 id={sectionId}>{t('pages.listingDetail.itinerary.heading')}</h2>
      <Timeline
        steps={timelineSteps}
        durationUnitLabel={t('pages.listingDetail.itinerary.minutesUnit')}
      />
    </Section>
  );
}

ListingItinerarySection.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      description: PropTypes.string,
      duration_minutes: PropTypes.number,
    }),
  ),
  sectionId: PropTypes.string,
};
