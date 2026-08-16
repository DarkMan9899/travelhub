/**
 * HighlightsList — flat icon + text highlights row shown on the listing
 * detail hero (`ListingHero.jsx`), from a listing's partner-authored
 * `listing_highlights` (migration 0026).
 */

import PropTypes from 'prop-types';
import styles from './HighlightsList.module.scss';

export default function HighlightsList({ highlights, className = undefined }) {
  return (
    <ul className={[styles.list, className].filter(Boolean).join(' ')}>
      {highlights.map((highlight) => {
        const Icon = highlight.icon;
        return (
          <li className={styles.item} key={highlight.text}>
            {Icon && (
              <Icon
                className={styles.icon}
                aria-hidden="true"
                focusable="false"
              />
            )}
            <span>{highlight.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

HighlightsList.propTypes = {
  highlights: PropTypes.arrayOf(
    PropTypes.shape({
      text: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
    }),
  ).isRequired,
  className: PropTypes.string,
};
