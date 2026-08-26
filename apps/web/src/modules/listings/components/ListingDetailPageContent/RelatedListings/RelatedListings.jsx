/**
 * RelatedListings — "more like this" strip, reusing `search`'s own
 * `useSearchListingsQuery` + `SearchResultCard` (both now exported from
 * `modules/search/index.js` for exactly this cross-module use) rather
 * than inventing a parallel same-category fetch/card. `GET /search`'s
 * flat DTO is exactly what a related-listings strip needs — no new
 * backend endpoint. Only the first page is shown (no "load more" here,
 * unlike the full search results page); the current listing is excluded
 * client-side since `GET /search` has no "exclude id" filter.
 *
 * Uses a plain responsive CSS grid (`.grid`), not the `Grid` layout
 * primitive — `Grid`'s fixed `columns` pins that count at every
 * breakpoint (no built-in mobile collapse), so card grids in this app
 * use a local `.module.scss` grid instead, matching
 * `CompaniesDirectoryPageContent`'s established pattern.
 */

import PropTypes from 'prop-types';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Section } from '@desavii/ui/components/layout';
import {
  useSearchListingsQuery,
  SearchResultCard,
} from '../../../../search/index.js';
import styles from './RelatedListings.module.scss';

export default function RelatedListings({
  categoryId = undefined,
  excludeListingId,
}) {
  const { locale } = useParams();
  const { t } = useTranslation();
  const { data } = useSearchListingsQuery({ categoryId }, { locale });

  const results = (data?.pages[0]?.results ?? []).filter(
    (result) => result.id !== excludeListingId,
  );

  if (!categoryId || results.length === 0) return null;

  return (
    <Section
      spacing="none"
      aria-label={t('pages.listingDetail.relatedListings.heading')}
    >
      <h2>{t('pages.listingDetail.relatedListings.heading')}</h2>
      <div className={styles.grid}>
        {results.map((result) => (
          <SearchResultCard key={result.id} result={result} />
        ))}
      </div>
    </Section>
  );
}

RelatedListings.propTypes = {
  categoryId: PropTypes.number,
  excludeListingId: PropTypes.number.isRequired,
};
