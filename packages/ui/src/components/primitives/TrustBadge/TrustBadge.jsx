/**
 * TrustBadge — Phase 18 (Premium Listing Detail Experience). Provider
 * trust signal (verified partner, featured listing, top-rated) shown
 * near a listing/company's identity. Distinct from Badge (a generic
 * status pill): always the Gold "luxury accent" token, per
 * `_colors.scss`'s "premium/verified badges only, never a button" rule,
 * and always icon-paired rather than color-only.
 */

import { ShieldCheck, Star, Award } from 'lucide-react';
import PropTypes from 'prop-types';
import styles from './TrustBadge.module.scss';

const VARIANTS = ['verified', 'topRated', 'featured'];

const DEFAULT_ICON_BY_VARIANT = {
  verified: ShieldCheck,
  topRated: Star,
  featured: Award,
};

export default function TrustBadge({
  variant = 'verified',
  label,
  icon = undefined,
}) {
  const IconComponent = icon ?? DEFAULT_ICON_BY_VARIANT[variant];

  return (
    <span className={styles.trustBadge}>
      <IconComponent
        className={styles.icon}
        aria-hidden="true"
        focusable="false"
      />
      <span>{label}</span>
    </span>
  );
}

TrustBadge.propTypes = {
  variant: PropTypes.oneOf(VARIANTS),
  label: PropTypes.string.isRequired,
  icon: PropTypes.elementType,
};

export { VARIANTS as TRUST_BADGE_VARIANTS };
