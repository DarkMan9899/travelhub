/**
 * CategoryCard — one entry in Categories, backed by a real
 * `GET /search/categories` row (`id`, `slug`, `name`, `listing_count`) —
 * not placeholder data. Icons come from `lucide-react` (Button's own
 * established pattern for "no standalone Icon primitive yet"), looked up
 * by `slug` with a generic fallback so a category the backend adds later
 * (this taxonomy isn't a fixed enum) still renders sensibly.
 *
 * Redesign phase (2026) — `featured` (the grid's first tile, set by
 * `Categories.jsx`) renders a visibly larger card with the label/count
 * floating over the bottom of its own mesh backdrop rather than the
 * regular tile's centered icon-then-label stack — the brief's "different
 * scale cards... floating labels" asymmetry, without needing a second
 * component. Every tile also gets a subtle pointer-tilt (`useTiltEffect`
 * — a bounded 8-card grid, not Showcase's Embla row, so a per-card
 * listener each is fine here).
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import RouterLink from '../../../../components/RouterLink.jsx';
import useTiltEffect from '../../../../hooks/useTiltEffect.js';
import { getCategoryIcon } from '../../../../utils/categoryIcons.js';
import styles from './CategoryCard.module.scss';

export default function CategoryCard({ category, featured = false }) {
  const { t } = useTranslation();
  const { locale } = useParams();
  const Icon = getCategoryIcon(category.slug);
  // Redesign phase (2026) — the same deterministic-per-id mesh variant
  // `DestinationArt` uses, at a much lower strength (a background wash,
  // not the card's whole surface): five categories in a row no longer
  // read as identical flat-white tiles differing only by icon.
  const meshIndex = Math.abs(Number(category.id) || 0) % 5;
  const tilt = useTiltEffect();

  return (
    <RouterLink
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      href={`/${locale}/categories/${category.slug}`}
      className={[
        styles.card,
        styles[`card--mesh-${meshIndex + 1}`],
        featured && styles['card--featured'],
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span className={styles.iconWrapper} aria-hidden="true">
        <Icon size={featured ? 36 : 28} />
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
  featured: PropTypes.bool,
};
