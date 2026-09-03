/**
 * FeaturedListings — the `home` module's real content (FRONTEND_ARCHITECTURE.md
 * §6): fetches published listings via the `search` module's public export
 * (§6.3's cross-module rule), and renders all three required states
 * (§1.4) — loading, empty, error — before content. Presented as a premium
 * showcase carousel (`Showcase`) rather than a static grid.
 *
 * Uses `useSearchListingsQuery`/`SearchResultCard` (`GET /search`'s flat,
 * already-localized DTO), not `listings`' `useListingsQuery`/`ListingCard`
 * — the same "no per-row follow-up call" reasoning `RelatedListings`
 * already documents. This section used to fetch this same data via
 * `useListingsQuery`, which followed up `GET /listings`' bare summary
 * list with one `GET /listings/:id` call per row: a real N+1 (8 extra
 * requests for 8 featured listings) that could exhaust the public rate
 * limit on its own and render this section with a heading but zero
 * cards. `GET /search` already returns everything a card needs — title,
 * cover image, price, rating — in the one list call, with anonymous
 * callers implicitly scoped to published listings server-side, so no
 * explicit status filter is needed here either.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Container, Section } from '@desavii/ui/components/layout';
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
import styles from './FeaturedListings.module.scss';

const HEADING_ID = 'featured-listings-heading';

export default function FeaturedListings() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { data, isPending, isError } = useSearchListingsQuery({}, { locale });
  const listings = data?.pages[0]?.results ?? [];

  return (
    <Section aria-labelledby={HEADING_ID} className={styles.section}>
      <Container size="wide">
        <ScrollReveal variant="depth">
          <SectionHeader
            id={HEADING_ID}
            eyebrow={t('home.featured.eyebrow')}
            title={t('home.featured.title')}
            subtitle={t('home.featured.subtitle')}
            viewAllHref={`/${locale}/search`}
            viewAllLabel={t('home.showcase.viewAll')}
          />
        </ScrollReveal>
      </Container>

      {isPending && (
        <Container size="wide">
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
        </Container>
      )}

      {isError && (
        <Container size="wide">
          <Alert variant="danger" title={t('home.featured.error.title')}>
            {t('home.featured.error.description')}
          </Alert>
        </Container>
      )}

      {!isPending && !isError && listings.length === 0 && (
        <Container size="wide">
          <EmptyState
            title={t('home.featured.empty.title')}
            description={t('home.featured.empty.description')}
          />
        </Container>
      )}

      {!isPending && !isError && listings.length > 0 && (
        <ScrollReveal delay={0.1} variant="depth" className={styles.bleedRow}>
          <Showcase
            ariaLabel={t('home.featured.title')}
            slideClassName={styles.slide}
          >
            {listings.map((listing) => (
              <SearchResultCard key={listing.id} result={listing} />
            ))}
          </Showcase>
        </ScrollReveal>
      )}
    </Section>
  );
}
