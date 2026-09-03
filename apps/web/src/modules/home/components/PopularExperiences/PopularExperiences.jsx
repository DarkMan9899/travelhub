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
 *
 * Redesign phase (2026) — this section's own scene identity within the
 * page-wide depth system: a dark cinematic panel (`SectionHeader
 * tone="dark"`), a giant low-opacity display-face word behind the
 * heading, and a route/path SVG — the same visual family as Hero's own
 * portal (route-line arcs), reused here at a much smaller scale rather
 * than invented fresh, so it still reads as "this app's" motif and not
 * a one-off illustration.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section } from '@desavii/ui/components/layout';
import {
  Skeleton,
  EmptyState,
  Alert,
} from '@desavii/ui/components/feedback-overlays';
import {
  useSearchListingsQuery,
  SearchResultCard,
} from '../../../search/index.js';
import SectionHeader from '../SectionHeader/SectionHeader.jsx';
import Showcase from '../Showcase/Showcase.jsx';
import ScrollReveal from '../ScrollReveal/ScrollReveal.jsx';
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
      <ScrollReveal variant="depth" className={styles.panel}>
        <p className={styles.backgroundWord} aria-hidden="true">
          {t('home.experiences.title')}
        </p>
        <svg
          className={styles.routeGraphic}
          viewBox="0 0 800 200"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            className={styles.routePath}
            d="M-20,150 C160,40 320,220 500,90 C620,4 700,120 820,60"
            fill="none"
          />
        </svg>
        <SectionHeader
          id={HEADING_ID}
          tone="dark"
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
      </ScrollReveal>
    </Section>
  );
}
