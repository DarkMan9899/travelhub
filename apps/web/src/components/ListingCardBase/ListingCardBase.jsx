/**
 * ListingCardBase — Phase 12 (Product Polish): the shared visual
 * structure `modules/search`'s `SearchResultCard` and `favorites`'
 * `FavoritesPageContent` row rendering each need (media block with type/
 * favorite/gallery badges, title/rating/summary/price body). Lives in
 * shared `components/` per FRONTEND_ARCHITECTURE.md §3.1/§7 ("promoted
 * once a second consumer genuinely needs it"). Phase 21 retired the
 * original second consumer, `modules/listings`' `ListingCard` (it read a
 * nested full-listing shape that required an N+1 `GET /listings/:id`
 * follow-up per row to populate — every real caller now goes through
 * `SearchResultCard`'s flat `GET /search` DTO instead, which needs no
 * follow-up call).
 *
 * Deliberately takes already-resolved primitive props (a title string, a
 * cover image URL, a numeric price), never a raw `listing`/`result`
 * domain object — each caller's source DTO shape differs, and reshaping
 * into a single object contract would mean inventing fields to satisfy a
 * prop contract that doesn't match the source. Each caller still owns
 * its own data extraction; this component only owns the shared markup/
 * styling.
 *
 * Takes a `favoriteButton` node rather than importing `FavoriteButton`
 * itself: shared top-level `components/` may never import from a
 * `modules/*` directory (FRONTEND_ARCHITECTURE.md's layering rule,
 * `eslint-plugin-boundaries`-enforced) — and `favorites`' own barrel
 * also exports `FavoritesPageContent`, which itself reuses this exact
 * component, so importing `FavoriteButton` here would close a real
 * `search -> ListingCardBase -> favorites -> FavoritesPageContent ->
 * ListingCardBase` cycle. Each caller (`SearchResultCard`,
 * `FavoritesPageContent`'s own row rendering) renders its own
 * `<FavoriteButton listingId={...} />` and passes it down instead.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { Images } from 'lucide-react';
import { Card, Badge, Icon } from '@desavii/ui/components/primitives';
import { PriceTag, RatingStars } from '@desavii/ui/components/data-display';
import RouterLink from '../RouterLink.jsx';
import styles from './ListingCardBase.module.scss';

export default function ListingCardBase({
  href,
  ariaLabel = undefined,
  imageUrl = undefined,
  imageAlt = '',
  typeLabel,
  favoriteButton = null,
  galleryCount = 0,
  title,
  location = null,
  summary = undefined,
  ratingAverage = undefined,
  reviewCount = 0,
  priceAmount = undefined,
  priceCurrencyCode = undefined,
  locale = undefined,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Card
      as={RouterLink}
      href={href}
      padding="none"
      interactive
      className={styles.card}
      aria-label={ariaLabel}
    >
      <div className={styles.media}>
        {imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            className={styles.image}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className={styles.imagePlaceholder} aria-hidden="true" />
        )}
        <span className={styles.typeBadge}>
          <Badge variant="info" label={typeLabel} size="sm" />
        </span>
        {favoriteButton && (
          <span className={styles.favoriteButton}>{favoriteButton}</span>
        )}
        {galleryCount > 1 && (
          <span className={styles.galleryBadge}>
            <Icon icon={Images} size="sm" />
            {galleryCount}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        {reviewCount > 0 && (
          <RatingStars
            value={ratingAverage}
            reviewCount={reviewCount}
            size="sm"
          />
        )}
        {location}
        {summary && <p className={styles.summary}>{summary}</p>}
        {priceAmount && (
          <PriceTag
            amount={priceAmount}
            currencyCode={priceCurrencyCode}
            locale={locale}
            size="sm"
          />
        )}
      </div>
    </Card>
  );
}

ListingCardBase.propTypes = {
  href: PropTypes.string.isRequired,
  ariaLabel: PropTypes.string,
  imageUrl: PropTypes.string,
  imageAlt: PropTypes.string,
  typeLabel: PropTypes.string.isRequired,
  favoriteButton: PropTypes.node,
  galleryCount: PropTypes.number,
  title: PropTypes.node.isRequired,
  location: PropTypes.node,
  summary: PropTypes.string,
  ratingAverage: PropTypes.number,
  reviewCount: PropTypes.number,
  priceAmount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  priceCurrencyCode: PropTypes.string,
  locale: PropTypes.string,
};
