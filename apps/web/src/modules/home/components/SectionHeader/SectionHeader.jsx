/**
 * SectionHeader — the shared eyebrow/title/subtitle/"view all" heading
 * block reused by every homepage section, so the pattern is written once
 * instead of once per section (Component architecture: "shared section
 * headers").
 */

import PropTypes from 'prop-types';
import RouterLink from '../../../../components/RouterLink.jsx';
import styles from './SectionHeader.module.scss';

export default function SectionHeader({
  id = undefined,
  eyebrow = undefined,
  title,
  subtitle = undefined,
  viewAllHref = undefined,
  viewAllLabel = undefined,
}) {
  return (
    <div className={styles.header}>
      <div className={styles.text}>
        {eyebrow && (
          <>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <span className={styles.accentRule} aria-hidden="true" />
          </>
        )}
        <h2 id={id} className={styles.title}>
          {title}
        </h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {viewAllHref && viewAllLabel && (
        <RouterLink href={viewAllHref} className={styles.viewAll}>
          {viewAllLabel}
        </RouterLink>
      )}
    </div>
  );
}

SectionHeader.propTypes = {
  id: PropTypes.string,
  eyebrow: PropTypes.string,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  viewAllHref: PropTypes.string,
  viewAllLabel: PropTypes.string,
};
