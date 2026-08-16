/**
 * PolicyList — one card per policy (icon + title + description),
 * replacing an earlier plain `<dl>` (`ListingPoliciesSection.jsx`).
 */

import PropTypes from 'prop-types';
import styles from './PolicyList.module.scss';

export default function PolicyList({ policies }) {
  return (
    <ul className={styles.list}>
      {policies.map((policy) => {
        const Icon = policy.icon;
        return (
          <li className={styles.card} key={policy.title}>
            {Icon && (
              <Icon
                className={styles.icon}
                aria-hidden="true"
                focusable="false"
              />
            )}
            <div className={styles.content}>
              <h3 className={styles.title}>{policy.title}</h3>
              <p className={styles.description}>{policy.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

PolicyList.propTypes = {
  policies: PropTypes.arrayOf(
    PropTypes.shape({
      icon: PropTypes.elementType,
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
    }),
  ).isRequired,
};
