/**
 * PopularExperiences — real published `TOUR` listings (`GET /search`,
 * filtered via the `listingType` param — see `searchParams.js`'s
 * `toSearchQueryParams`), presented as a premium showcase carousel
 * (`Showcase`). Mirrors `FeaturedListings.jsx`'s exact data-fetching and
 * state-handling pattern (loading/empty/error before content).
 *
 * P1.6 (Master Roadmap): replaces the previous version, which rendered
 * six fully fabricated ratings/review counts/prices
 * (`constants/experiences.js`, now deleted) as if they were real.
 *
 * `listingType: 'TOUR'` only, not `ATTRACTION` too — `GET /search` takes
 * one `listingType` per request, and Tours are this marketplace's
 * primary "experience" listing type.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@travelhub/ui/components/layout';
import {
  Skeleton,
  EmptyState,
  Alert,
} from '@travelhub/ui/components/feedback-overlays';
import {
  useSearchListingsQuery,
  SearchResultCard,
} from '../../../search/index.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import Showcase from '../Showcase/Showcase.jsx';
import styles from './PopularExperiences.module.scss';

const HEADING_ID = 'popular-experiences-heading';

export default function PopularExperiences() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError } = useSearchListingsQuery(
    { listingType: 'TOUR' },
    { locale },
  );
  const experiences = data?.pages[0]?.results ?? [];

  return (
    <Section aria-labelledby={HEADING_ID}>
      <div className={styles.panel}>
        <SectionHeader
          id={HEADING_ID}
          eyebrow={t('home.experiences.eyebrow')}
          title={t('home.experiences.title')}
          subtitle={t('home.experiences.subtitle')}
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
          <Alert variant="danger" title={t('home.experiences.error.title')}>
            {t('home.experiences.error.description')}
          </Alert>
        )}

        {!isPending && !isError && experiences.length === 0 && (
          <EmptyState
            title={t('home.experiences.empty.title')}
            description={t('home.experiences.empty.description')}
          />
        )}

        {!isPending && !isError && experiences.length > 0 && (
          <Showcase
            ariaLabel={t('home.experiences.title')}
            slideClassName={styles.slide}
          >
            {experiences.map((experience) => (
              <SearchResultCard key={experience.id} result={experience} />
            ))}
          </Showcase>
        )}
      </div>
    </Section>
  );
}
