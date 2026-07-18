/**
 * Skeleton — COMPONENT_LIBRARY.md Part II §4 "Skeleton".
 *
 * Shape-matching loading placeholder — the default loading treatment
 * platform-wide. This is the shared text/circle/rect primitive;
 * component-specific shapes (`ListingCardSkeleton`, `BookingRowSkeleton`,
 * ...) compose several of these together and are out of this sprint's
 * scope (they belong to their owning module, not the shared ui/ layer).
 *
 * `width`/`height` are inline styles rather than tokens deliberately —
 * a skeleton's whole purpose is matching an arbitrary real component's
 * arbitrary content dimensions, which cannot be pre-enumerated as a
 * fixed design-token scale the way color/spacing/radius/typography can
 * (FRONTEND_ARCHITECTURE.md §8.4's "no inline style" rule targets visual
 * design overrides, not content-shape dimensions).
 */

import PropTypes from 'prop-types';
import styles from './Skeleton.module.scss';

const VARIANTS = ['text', 'circle', 'rect'];

export default function Skeleton({ variant, width, height, count, className }) {
  return (
    <span className={styles.container} aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key -- skeleton
          // placeholders are positionally static, non-reorderable, and
          // carry no identity of their own to key by.
          key={index}
          aria-hidden="true"
          className={[
            styles.skeleton,
            styles[`skeleton--${variant}`],
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ width, height }}
        />
      ))}
    </span>
  );
}

Skeleton.propTypes = {
  variant: PropTypes.oneOf(VARIANTS),
  width: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  count: PropTypes.number,
  className: PropTypes.string,
};

Skeleton.defaultProps = {
  variant: 'text',
  width: undefined,
  height: undefined,
  count: 1,
  className: undefined,
};

export { VARIANTS as SKELETON_VARIANTS };
