/**
 * Button — COMPONENT_LIBRARY.md Part II §1 "Button".
 *
 * The single interactive-action element used platform-wide. Native
 * <button> semantics throughout (never a styled <div>), so keyboard
 * activation (Space/Enter) and default focus behaviour come for free.
 *
 * Icon/Spinner are referenced as "Dependencies" in the spec but are not
 * yet standalone ui/ primitives (COMPONENT_LIBRARY.md Part II §1's Icon
 * entry and the Feedback group's Loading Spinner are out of this sprint's
 * scope). `iconLeft`/`iconRight` therefore accept any renderable node
 * (e.g. a lucide-react icon element supplied by the consumer) and the
 * loading indicator is a small element private to this component rather
 * than a separately exported Spinner.
 */

import PropTypes from 'prop-types';
import styles from './Button.module.scss';

const VARIANTS = ['primary', 'secondary', 'ghost', 'destructive'];
const SIZES = ['sm', 'md', 'lg'];

function LoadingIndicator() {
  return (
    <svg
      className={styles.spinner}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className={styles.spinnerTrack}
        cx="12"
        cy="12"
        r="9"
        strokeWidth="3"
      />
      <circle
        className={styles.spinnerIndicator}
        cx="12"
        cy="12"
        r="9"
        strokeWidth="3"
      />
    </svg>
  );
}

export default function Button({
  children,
  variant,
  size,
  disabled,
  loading,
  iconLeft,
  iconRight,
  fullWidth,
  type,
  onClick,
  ariaLabel,
}) {
  const iconOnly = !children && (iconLeft || iconRight);

  const className = [
    styles.button,
    styles[`button--${variant}`],
    styles[`button--${size}`],
    fullWidth && styles['button--full-width'],
    loading && styles['button--loading'],
    iconOnly && styles['button--icon-only'],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type === 'submit' ? 'submit' : 'button'}
      className={className}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className={styles.content}>
        {iconLeft && (
          <span className={styles.icon} aria-hidden="true">
            {iconLeft}
          </span>
        )}
        {children && <span className={styles.label}>{children}</span>}
        {iconRight && (
          <span className={styles.icon} aria-hidden="true">
            {iconRight}
          </span>
        )}
      </span>
      {loading && (
        <span className={styles.spinnerWrapper}>
          <LoadingIndicator />
        </span>
      )}
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(VARIANTS),
  size: PropTypes.oneOf(SIZES),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  fullWidth: PropTypes.bool,
  type: PropTypes.oneOf(['button', 'submit']),
  onClick: PropTypes.func,
  ariaLabel: PropTypes.string,
};

Button.defaultProps = {
  children: undefined,
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  iconLeft: undefined,
  iconRight: undefined,
  fullWidth: false,
  type: 'button',
  onClick: undefined,
  ariaLabel: undefined,
};

export { VARIANTS as BUTTON_VARIANTS, SIZES as BUTTON_SIZES };
