/**
 * Badge — COMPONENT_LIBRARY.md Part II §1 "Badge".
 *
 * The single sanctioned mapping of a status value to a color — reused,
 * never re-implemented, by BookingStatusBadge/payment-status/listing-
 * status usages built in later, feature-owning sprints.
 *
 * Color mapping note: `_colors.scss` (COMPONENT_LIBRARY.md Part I) does
 * not define dedicated "info" or "neutral" tokens. `info` reuses Royal
 * Blue (the platform's one interactive/informational accent) and
 * `neutral` reuses the Gray scale — both existing tokens, not new
 * hardcoded values, so the "never hardcode a color" rule holds.
 */

import PropTypes from 'prop-types';
import styles from './Badge.module.scss';

const VARIANTS = ['success', 'warning', 'danger', 'neutral', 'info'];
const SIZES = ['sm', 'md'];

export default function Badge({ variant, label, size, filled }) {
  const className = [
    styles.badge,
    styles[`badge--${variant}`],
    styles[`badge--${size}`],
    filled ? styles['badge--filled'] : styles['badge--unfilled'],
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={className}>{label}</span>;
}

Badge.propTypes = {
  variant: PropTypes.oneOf(VARIANTS),
  label: PropTypes.string.isRequired,
  size: PropTypes.oneOf(SIZES),
  filled: PropTypes.bool,
};

Badge.defaultProps = {
  variant: 'neutral',
  size: 'md',
  filled: false,
};

export { VARIANTS as BADGE_VARIANTS, SIZES as BADGE_SIZES };
