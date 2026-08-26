/**
 * FeaturedDestinations — real seeded cities (`GET /search/destinations`,
 * `useDestinationsQuery`), presented as a premium showcase carousel
 * (`Showcase`). Mirrors `Categories.jsx`'s real-data state-handling
 * pattern (loading/empty/error before content).
 *
 * P1.6 (Master Roadmap): replaces the previous fully-fabricated 6-city
 * placeholder list (`constants/destinations.js`, now deleted) and its
 * per-id-keyed static i18n copy. Only cities with at least one published
 * listing are shown — a destination with zero listings would link
 * straight into an empty results page — sorted by listing count so the
 * busiest, most useful destinations surface first, capped to a
 * curated-feeling handful.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@desavii/ui/components/layout';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@desavii/ui/components/feedback-overlays';
import { useDestinationsQuery } from '../../../search/index.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import Showcase from '../Showcase/Showcase.jsx';
import DestinationCard from '../DestinationCard/DestinationCard.jsx';
import styles from './FeaturedDestinations.module.scss';

const HEADING_ID = 'featured-destinations-heading';
const FEATURED_DESTINATIONS_LIMIT = 6;

export default function FeaturedDestinations() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError, refetch } = useDestinationsQuery({
    locale,
  });
  const destinations = (data ?? [])
    .filter((destination) => destination.listing_count > 0)
    .sort((a, b) => b.listing_count - a.listing_count)
    .slice(0, FEATURED_DESTINATIONS_LIMIT);

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

      {isPending && (
        <div className={styles.skeletonRow}>
          {Array.from({ length: 4 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- skeleton
            // placeholders are positionally static, non-reorderable.
            <Skeleton
              key={index}
              variant="rect"
              height={280}
              className={styles.slide}
            />
          ))}
        </div>
      )}

      {isError && (
        <ErrorState
          title={t('home.destinations.error.title')}
          description={t('home.destinations.error.description')}
          retryLabel={t('home.destinations.error.retry')}
          onRetry={() => refetch()}
        />
      )}

      {!isPending && !isError && destinations.length === 0 && (
        <EmptyState
          title={t('home.destinations.empty.title')}
          description={t('home.destinations.empty.description')}
        />
      )}

      {!isPending && !isError && destinations.length > 0 && (
        <Showcase
          ariaLabel={t('home.destinations.title')}
          slideClassName={styles.slide}
        >
          {destinations.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </Showcase>
      )}
    </Section>
  );
}
