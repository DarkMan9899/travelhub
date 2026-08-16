/**
 * FeaturedDestinations — curated Armenian destinations, presented as a
 * premium showcase carousel (`Showcase`) rather than a static grid.
 * Placeholder data (constants/destinations.js) since no destinations API
 * exists this phase; see that file's header for the "real data, not yet
 * an endpoint" distinction versus Categories, which reuses a real enum.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@travelhub/ui/components/layout';
import FEATURED_DESTINATIONS from '../../constants/destinations.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import Showcase from '../Showcase/Showcase.jsx';
import DestinationCard from '../DestinationCard/DestinationCard.jsx';
import styles from './FeaturedDestinations.module.scss';

const HEADING_ID = 'featured-destinations-heading';

export default function FeaturedDestinations() {
  const { t } = useTranslation();
  const { locale } = useParams();

  return (
    <Section aria-labelledby={HEADING_ID}>
      <SectionHeader
        id={HEADING_ID}
        eyebrow={t('home.destinations.eyebrow')}
        title={t('home.destinations.title')}
        subtitle={t('home.destinations.subtitle')}
        viewAllHref={`/${locale}/search`}
        viewAllLabel={t('home.showcase.viewAll')}
      />
      <Showcase
        ariaLabel={t('home.destinations.title')}
        slideClassName={styles.slide}
      >
        {FEATURED_DESTINATIONS.map((destination) => (
          <DestinationCard key={destination.id} destination={destination} />
        ))}
      </Showcase>
    </Section>
  );
}
