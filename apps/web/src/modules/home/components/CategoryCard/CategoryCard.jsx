/**
 * CategoryCard — one entry in Categories, backed by a real
 * `GET /search/categories` row (`id`, `slug`, `name`, `listing_count`) —
 * not placeholder data. Icons come from `lucide-react` (Button's own
 * established pattern for "no standalone Icon primitive yet"), looked up
 * by `slug` with a generic fallback so a category the backend adds later
 * (this taxonomy isn't a fixed enum) still renders sensibly.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  Building2,
  Home,
  UtensilsCrossed,
  Map,
  Car,
  Landmark,
  Palmtree,
  BedDouble,
  Compass,
} from 'lucide-react';
import RouterLink from '../../../../components/RouterLink.jsx';
import styles from './CategoryCard.module.scss';

const ICONS_BY_SLUG = {
  hotels: Building2,
  apartments: Home,
  restaurants: UtensilsCrossed,
  tours: Map,
  'car-rentals': Car,
  attractions: Landmark,
  villas: Palmtree,
  'guest-houses': BedDouble,
};

export default function CategoryCard({ category }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const Icon = ICONS_BY_SLUG[category.slug] ?? Compass;

  return (
    <RouterLink
      href={`/${locale}/categories/${category.slug}`}
      className={styles.card}
    >
      <span className={styles.iconWrapper} aria-hidden="true">
        <Icon size={32} />
      </span>
      <span className={styles.label}>{category.name}</span>
      {category.listing_count > 0 && (
        <span className={styles.count}>
          {t('home.categories.listingCount', { count: category.listing_count })}
        </span>
      )}
    </RouterLink>
  );
}

CategoryCard.propTypes = {
  category: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    slug: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    listing_count: PropTypes.number,
  }).isRequired,
};
