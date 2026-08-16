/**
 * IncludedItemsList — two-column included/not-included display
 * (`ListingIncludedSection.jsx`), partner-authored content only.
 */

import PropTypes from 'prop-types';
import styles from './IncludedItemsList.module.scss';

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function IncludedItemsList({
  items,
  includedHeading,
  excludedHeading,
}) {
  const included = items.filter((item) => item.is_included);
  const excluded = items.filter((item) => !item.is_included);

  return (
    <div className={styles.columns}>
      {included.length > 0 && (
        <div className={styles.column}>
          <h3 className={styles.heading}>{includedHeading}</h3>
          <ul className={styles.list}>
            {included.map((item) => (
              <li className={styles.item} key={item.item_text}>
                <span
                  className={[styles.icon, styles['icon--included']].join(' ')}
                >
                  <CheckIcon />
                </span>
                <span>{item.item_text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {excluded.length > 0 && (
        <div className={styles.column}>
          <h3 className={styles.heading}>{excludedHeading}</h3>
          <ul className={styles.list}>
            {excluded.map((item) => (
              <li className={styles.item} key={item.item_text}>
                <span
                  className={[styles.icon, styles['icon--excluded']].join(' ')}
                >
                  <CrossIcon />
                </span>
                <span>{item.item_text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

IncludedItemsList.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      item_text: PropTypes.string.isRequired,
      is_included: PropTypes.bool.isRequired,
    }),
  ).isRequired,
  includedHeading: PropTypes.string.isRequired,
  excludedHeading: PropTypes.string.isRequired,
};
