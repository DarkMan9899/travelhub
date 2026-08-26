/**
 * ListingHero — Phase 18 (Premium Listing Detail): the immersive top of
 * the page. Replaces the old flat `PageHeader` + grid-only `ListingGallery`
 * with the shared `Gallery` primitive (mosaic + lightbox, `packages/ui`)
 * and a real identity block below it — category, title, location, rating,
 * partner-authored highlights, and the primary actions (Ask AI, Favorite,
 * Share). Every piece is conditionally rendered: a listing with no
 * highlights, no reviews yet, or an unresolved category still renders a
 * complete, honest hero, never an empty label or a fabricated "0.0".
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import {
  HighlightsList,
  RatingStars,
} from '@desavii/ui/components/data-display';
import { Gallery } from '@desavii/ui/components/listing-media';
import { Inline, Stack } from '@desavii/ui/components/layout';
import resolveHighlightIcon from '../../../utils/highlightIcons.js';
import styles from './ListingHero.module.scss';

function toGalleryMedia(media) {
  return media
    .filter(
      (item) => item.media_type === 'IMAGE' || item.media_type === 'VIDEO',
    )
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      id: item.id,
      url: item.url,
      mediaType: item.media_type,
      alt: item.alt_text ?? '',
    }));
}

export default function ListingHero({
  media = [],
  title,
  categoryLabel = null,
  cityName = null,
  countryName = null,
  ratingAverage = null,
  reviewCount = 0,
  highlights = [],
  reviewsAnchorId,
  actions = undefined,
}) {
  const { t } = useTranslation();
  const locationLabel = [cityName, countryName].filter(Boolean).join(', ');
  const galleryMedia = toGalleryMedia(media);
  const iconHighlights = highlights.map((highlight) => ({
    text: highlight.text,
    icon: resolveHighlightIcon(highlight.icon_code),
  }));

  return (
    <Stack gap="4" className={styles.hero}>
      {galleryMedia.length > 0 && (
        <Gallery
          media={galleryMedia}
          viewImageLabel={t('pages.listingDetail.gallery.viewPhoto')}
          viewAllLabel={(count) =>
            t('pages.listingDetail.gallery.morePhotos', { count })
          }
          closeLabel={t('pages.listingDetail.gallery.closeLightbox')}
          previousLabel={t('pages.listingDetail.gallery.previousImage')}
          nextLabel={t('pages.listingDetail.gallery.nextImage')}
          imageCounterLabel={(current, total) =>
            t('pages.listingDetail.gallery.imageCounter', { current, total })
          }
        />
      )}

      <Inline
        justify="space-between"
        align="flex-start"
        gap="4"
        wrap
        className={styles.identityRow}
      >
        <Stack gap="2" className={styles.identity}>
          {categoryLabel && (
            <span className={styles.category}>{categoryLabel}</span>
          )}
          <h1 className={styles.title}>{title}</h1>
          <Inline gap="4" align="center" wrap className={styles.metaRow}>
            {locationLabel && (
              <span className={styles.location}>
                <MapPin size={16} aria-hidden="true" />
                {locationLabel}
              </span>
            )}
            {ratingAverage !== null ? (
              <a href={`#${reviewsAnchorId}`} className={styles.ratingLink}>
                <RatingStars value={ratingAverage} size="sm" />
                <span className={styles.reviewCount}>
                  {t('pages.listingDetail.hero.reviewsLink', {
                    count: reviewCount,
                  })}
                </span>
              </a>
            ) : (
              <span className={styles.noRating}>
                {t('pages.listingDetail.hero.noReviews')}
              </span>
            )}
          </Inline>
        </Stack>

        {actions && <div className={styles.actions}>{actions}</div>}
      </Inline>

      {iconHighlights.length > 0 && (
        <HighlightsList
          highlights={iconHighlights}
          className={styles.highlights}
        />
      )}
    </Stack>
  );
}

ListingHero.propTypes = {
  media: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      media_type: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired,
      position: PropTypes.number,
      alt_text: PropTypes.string,
    }),
  ),
  title: PropTypes.string.isRequired,
  categoryLabel: PropTypes.string,
  cityName: PropTypes.string,
  countryName: PropTypes.string,
  ratingAverage: PropTypes.number,
  reviewCount: PropTypes.number,
  highlights: PropTypes.arrayOf(
    PropTypes.shape({
      icon_code: PropTypes.string,
      text: PropTypes.string.isRequired,
    }),
  ),
  reviewsAnchorId: PropTypes.string.isRequired,
  actions: PropTypes.node,
};
