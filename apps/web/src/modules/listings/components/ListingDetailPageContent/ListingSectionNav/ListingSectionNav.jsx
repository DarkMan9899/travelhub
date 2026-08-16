/**
 * ListingSectionNav — Phase 18 (Premium Listing Detail): a sticky
 * in-page jump-nav for the (potentially long) main content column. Takes
 * only the sections that are actually present on this listing —
 * `ListingDetailPageContent` filters the list itself based on which
 * sections rendered something — so a Tour with no Amenities never shows
 * a dead "Amenities" link. Plain anchor links (`href="#id"`), not a JS
 * scroll-spy: simplest correct mechanism, works with the browser's own
 * back/forward and keyboard navigation for free.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import styles from './ListingSectionNav.module.scss';

export default function ListingSectionNav({ sections }) {
  const { t } = useTranslation();

  if (sections.length === 0) return null;

  return (
    <nav
      className={styles.nav}
      aria-label={t('pages.listingDetail.sectionNav.ariaLabel')}
    >
      <ul className={styles.list}>
        {sections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`} className={styles.link}>
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

ListingSectionNav.propTypes = {
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
};
