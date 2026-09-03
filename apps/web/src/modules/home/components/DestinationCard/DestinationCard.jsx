/**
 * DestinationCard — one entry in FeaturedDestinations, backed by a real
 * `GET /search/destinations` row (`id`, `slug`, `name`, `listing_count`)
 * — not placeholder data. Always links to its real, indexable
 * `/destinations/:slug` landing page (`DestinationPageContent` resolves
 * any seeded city slug, not just a curated subset). The backdrop is
 * `DestinationArt` (procedural, `id`-seeded) rather than a per-city
 * photo — no real city imagery exists yet, same "real data, no per-row
 * photo" honesty as `CategoryCard`'s icon-instead-of-photo choice.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import RouterLink from '../../../../components/RouterLink.jsx';
import DestinationArt from '../../../../components/DestinationArt/DestinationArt.jsx';
import styles from './DestinationCard.module.scss';

export default function DestinationCard({ destination }) {
  const { t } = useTranslation();
  const { locale } = useParams();

  return (
    <RouterLink
      href={`/${locale}/destinations/${destination.slug}`}
      className={styles.card}
    >
      <div className={styles.media}>
        <DestinationArt seed={destination.id} className={styles.image} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{destination.name}</h3>
        {destination.listing_count > 0 && (
          <p className={styles.description}>
            {t('home.categories.listingCount', {
              count: destination.listing_count,
            })}
          </p>
        )}
      </div>
    </RouterLink>
  );
}

DestinationCard.propTypes = {
  destination: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    listing_count: PropTypes.number,
  }).isRequired,
};
