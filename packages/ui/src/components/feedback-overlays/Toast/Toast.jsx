/**
 * Toast — pure presentation only; the ephemeral queue, stacking, and
 * auto-dismiss timing live in `apps/web/src/providers/ToastProvider.jsx`
 * (an application-level concern, not this package's).
 */

import PropTypes from 'prop-types';
import styles from './Toast.module.scss';

const VARIANTS = ['info', 'success', 'warning', 'danger'];

export default function Toast({
  message,
  variant = 'info',
  onDismiss,
  dismissLabel = 'Dismiss',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={[styles.toast, styles[`toast--${variant}`]].join(' ')}
    >
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.dismiss}
        aria-label={dismissLabel}
        onClick={onDismiss}
      >
        &times;
      </button>
    </div>
  );
}

Toast.propTypes = {
  message: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(VARIANTS),
  onDismiss: PropTypes.func.isRequired,
  dismissLabel: PropTypes.string,
};

export { VARIANTS as TOAST_VARIANTS };
