/**
 * Spinner — COMPONENT_LIBRARY.md Part II §4 "Loading Spinner".
 *
 * Sub-second or button-level in-flight indicator — never used for
 * full-page/list loading (that's Skeleton's job, COMPONENT_LIBRARY.md's
 * Skeleton entry). Used both standalone and inline inside
 * `primitives/Button`'s loading state (see that component).
 */

import PropTypes from 'prop-types';
import styles from './Spinner.module.scss';

const SIZES = ['sm', 'md', 'lg'];

export default function Spinner({ size, label, decorative, className }) {
  return (
    <span
      // `decorative`: for the "inline within a Button" variant
      // (COMPONENT_LIBRARY.md Loading Spinner Variants) — the host button
      // already carries `aria-busy` and its own accessible name, so a
      // second, independent role="status" announcement here would be
      // redundant/confusing rather than helpful.
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={[styles.spinner, styles[`spinner--${size}`], className]
        .filter(Boolean)
        .join(' ')}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
        <circle
          className={styles.track}
          cx="12"
          cy="12"
          r="9"
          strokeWidth="3"
        />
        <circle
          className={styles.indicator}
          cx="12"
          cy="12"
          r="9"
          strokeWidth="3"
        />
      </svg>
    </span>
  );
}

Spinner.propTypes = {
  size: PropTypes.oneOf(SIZES),
  label: PropTypes.string,
  decorative: PropTypes.bool,
  className: PropTypes.string,
};

Spinner.defaultProps = {
  size: 'md',
  label: 'Loading',
  decorative: false,
  className: undefined,
};

export { SIZES as SPINNER_SIZES };
