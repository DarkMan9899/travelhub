/**
 * ReviewSummary — COMPONENT_LIBRARY.md Part II §5 "Review Card"'s
 * aggregate counterpart: the big-average-plus-stars header shown above
 * a listing's review list (`ListingReviewsSection.jsx`). `distribution`
 * (a per-star breakdown, 5→1) is optional and only rendered when the
 * caller actually has one — this package's README explicitly avoids
 * fabricating an estimate when the backend doesn't compute it.
 */

import PropTypes from 'prop-types';
import RatingStars from '../RatingStars/RatingStars.jsx';
import styles from './ReviewSummary.module.scss';

export default function ReviewSummary({
  average,
  reviewCount,
  distribution = undefined,
  reviewsLabel = 'reviews',
}) {
  const rounded = Math.round(average * 10) / 10;
  const maxCount = distribution
    ? Math.max(...distribution.map((entry) => entry.count), 1)
    : 0;

  return (
    <div className={styles.reviewSummary}>
      <div className={styles.headline}>
        <span className={styles.average}>{rounded}</span>
        <div className={styles.starsAndCount}>
          <RatingStars value={average} showCount={false} />
          <span className={styles.count}>
            {reviewCount} {reviewsLabel}
          </span>
        </div>
      </div>
      {distribution && distribution.length > 0 && (
        <ul className={styles.distribution}>
          {distribution.map((entry) => (
            <li key={entry.stars} className={styles.distributionRow}>
              <span className={styles.distributionLabel}>{entry.stars}</span>
              <span className={styles.distributionTrack}>
                <span
                  className={styles.distributionFill}
                  style={{ width: `${(entry.count / maxCount) * 100}%` }}
                />
              </span>
              <span className={styles.distributionCount}>{entry.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

ReviewSummary.propTypes = {
  average: PropTypes.number.isRequired,
  reviewCount: PropTypes.number.isRequired,
  distribution: PropTypes.arrayOf(
    PropTypes.shape({
      stars: PropTypes.number.isRequired,
      count: PropTypes.number.isRequired,
    }),
  ),
  reviewsLabel: PropTypes.string,
};
