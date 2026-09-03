/**
 * CompanyAvatar — a company's `logo_url` when it has one, otherwise an
 * intentional procedural fallback instead of a flat gray circle: the
 * company's own initials over one of the same five brand mesh gradients
 * `DestinationArt` uses (`seedToIndex`, keyed by the company's id/slug so
 * it's stable), matching the "no real photo pipeline yet" convention
 * already established for listings/categories rather than inventing a
 * separate visual language just for companies.
 */

import PropTypes from 'prop-types';
import { seedToIndex } from '../DestinationArt/DestinationArt.jsx';
import styles from './CompanyAvatar.module.scss';

function getInitials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CompanyAvatar({
  name,
  logoUrl = undefined,
  seed = undefined,
  size = 64,
}) {
  const sizeStyle = { width: size, height: size };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={styles.avatar}
        style={sizeStyle}
        loading="lazy"
      />
    );
  }

  const index = seedToIndex(seed ?? name);
  return (
    <div
      className={[
        styles.avatar,
        styles[`avatar--mesh-${(index % 5) + 1}`],
      ].join(' ')}
      style={sizeStyle}
      aria-hidden="true"
    >
      <span
        className={styles.initials}
        style={{ fontSize: Math.round(size * 0.36) }}
      >
        {getInitials(name)}
      </span>
    </div>
  );
}

CompanyAvatar.propTypes = {
  name: PropTypes.string.isRequired,
  logoUrl: PropTypes.string,
  seed: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  size: PropTypes.number,
};
