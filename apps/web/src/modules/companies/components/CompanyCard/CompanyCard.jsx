/**
 * CompanyCard — one `GET /partners` directory row (Phase 10 redesign).
 * First real consumer of the new shared `Card` primitive
 * (`packages/ui/components/primitives/Card`) — built directly on it
 * rather than hand-rolling the hover-lift/scrim/hover-scale treatment a
 * third time (`ListingCard`/`SearchResultCard` each already do), which
 * is exactly the duplication `Card` exists to remove (see its own file
 * header). Only fields `GET /partners` actually returns are rendered —
 * no rating (no Reviews module exists anywhere in this schema).
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Card, Icon } from '@desavii/ui/components/primitives';
import RouterLink from '../../../../components/RouterLink.jsx';
import styles from './CompanyCard.module.scss';

export default function CompanyCard({ company }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Card
      as={RouterLink}
      href={`/${locale}/companies/${company.slug}`}
      padding="none"
      interactive
      className={styles.card}
      aria-label={t('companies.card.viewProfile', {
        name: company.display_name,
      })}
    >
      <div className={styles.media}>
        {company.cover_url && !imageFailed ? (
          <img
            src={company.cover_url}
            alt=""
            className={styles.image}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        {company.logo_url && (
          <img
            src={company.logo_url}
            alt=""
            className={styles.logo}
            loading="lazy"
          />
        )}
      </div>
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <h3 className={styles.name}>{company.display_name}</h3>
          {company.is_verified && (
            <span className={styles.verifiedBadge}>
              <Icon
                icon={ShieldCheck}
                size="sm"
                label={t('companies.card.verified')}
              />
            </span>
          )}
        </div>
        {company.description && (
          <p className={styles.description}>{company.description}</p>
        )}
        <p className={styles.listingCount}>
          {t('companies.card.listingCount', { count: company.listing_count })}
        </p>
      </div>
    </Card>
  );
}

CompanyCard.propTypes = {
  // Real `GET /partners` row shape, not a hand-authored prop contract —
  // same convention `SearchResultCard`'s own file header documents.
  // eslint-disable-next-line react/forbid-prop-types
  company: PropTypes.object.isRequired,
};
