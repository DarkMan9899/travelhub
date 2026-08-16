/**
 * DestinationCard — one entry in FeaturedDestinations. Localized copy is
 * looked up here (`home.destinations.items.<id>.*`) so the section
 * component only maps ids — the same internal-lookup shape ListingCard
 * uses for its own translated fields.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import RouterLink from '../../../../components/RouterLink.jsx';
import styles from './DestinationCard.module.scss';

export default function DestinationCard({ destination }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const name = t(`home.destinations.items.${destination.id}.name`);
  const description = t(
    `home.destinations.items.${destination.id}.description`,
  );
  // Phase 20 (SEO): 5 of these 6 curated ids are real seeded `cities.slug`
  // values (`yerevan`/`dilijan`/`sevan`/`gyumri`/`jermuk`) and now have a
  // real, indexable `/destinations/:slug` landing page — link there
  // directly rather than through the noindex Search page. `tatev` is a
  // landmark, not a seeded city row, so it keeps the honest search-based
  // link (there is no destination page for it to point to).
  const REAL_DESTINATION_SLUGS = [
    'yerevan',
    'dilijan',
    'sevan',
    'gyumri',
    'jermuk',
  ];
  const href = REAL_DESTINATION_SLUGS.includes(destination.id)
    ? `/${locale}/destinations/${destination.id}`
    : `/${locale}/search?destination=${encodeURIComponent(name)}`;

  return (
    <RouterLink href={href} className={styles.card}>
      <div className={styles.media}>
        <img
          src={destination.image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={styles.image}
        />
      </div>
      <div className={styles.body}>
        <h3 className={styles.name}>{name}</h3>
        <p className={styles.description}>{description}</p>
      </div>
    </RouterLink>
  );
}

DestinationCard.propTypes = {
  destination: PropTypes.shape({
    id: PropTypes.string.isRequired,
    image: PropTypes.string.isRequired,
  }).isRequired,
};
