/**
 * Alert — not a COMPONENT_LIBRARY.md Part II §4 catalog entry (see this
 * sprint's report for why it was built anyway: a persistent inline
 * message banner is a distinct need from Toast, which is explicitly
 * "ephemeral, session-local... never a durable record"
 * (COMPONENT_LIBRARY.md's Toast entry) — form-level validation summaries
 * and page-level notices need to stay visible until the user resolves
 * or dismisses them, not auto-expire.
 *
 * Modeled on Toast's variant/color mapping and accessibility split for
 * consistency with the rest of the Feedback & Overlays group: `danger`
 * uses `role="alert"` (assertive), everything else `role="status"`
 * (polite) — mirroring COMPONENT_LIBRARY.md's Toast "aria-live='polite'
 * ('assertive' for errors)" clause.
 */

import PropTypes from 'prop-types';
import Button from '../../primitives/Button/Button.jsx';
import styles from './Alert.module.scss';

const VARIANTS = ['success', 'warning', 'danger', 'info'];

const ICONS = {
  success: (
    <path
      d="M4 10.5 8 14.5 16 5.5"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  danger: (
    <path
      d="M10 5v6M10 14.5h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  warning: (
    <path
      d="M10 2 18 17H2L10 2ZM10 8v4M10 14.5h.01"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  info: (
    <path
      d="M10 9v5M10 6.5h.01M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export default function Alert({
  variant,
  title,
  children,
  dismissible,
  onDismiss,
}) {
  const isUrgent = variant === 'danger';

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      className={[styles.alert, styles[`alert--${variant}`]].join(' ')}
    >
      <svg
        className={styles.icon}
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        {ICONS[variant]}
      </svg>
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.message}>{children}</div>}
      </div>
      {dismissible && (
        <Button
          variant="ghost"
          size="sm"
          ariaLabel="Dismiss"
          onClick={onDismiss}
          iconLeft={
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path
                d="M5 5l10 10M15 5 5 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          }
        />
      )}
    </div>
  );
}

Alert.propTypes = {
  variant: PropTypes.oneOf(VARIANTS),
  title: PropTypes.string,
  children: PropTypes.node,
  dismissible: PropTypes.bool,
  onDismiss: PropTypes.func,
};

Alert.defaultProps = {
  variant: 'info',
  title: undefined,
  children: undefined,
  dismissible: false,
  onDismiss: undefined,
};

export { VARIANTS as ALERT_VARIANTS };
