/**
 * Checkbox — COMPONENT_LIBRARY.md Part II §2 "Checkbox / Radio / Switch".
 * Native <input type="checkbox"> (never a bare styled <div>), visually
 * hidden and replaced by a custom box driven off its :checked/:focus-visible
 * state — the label wraps both so clicking the label toggles the control
 * (COMPONENT_LIBRARY.md's shared Accessibility clause).
 */

import { useEffect, useId, useRef } from 'react';
import PropTypes from 'prop-types';
import styles from './Checkbox.module.scss';

export default function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  indeterminate,
  error,
  name,
  value,
}) {
  const inputRef = useRef(null);
  const controlId = useId();
  const errorId = `${controlId}-error`;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className={styles.field}>
      <label
        htmlFor={controlId}
        className={[styles.wrapper, disabled && styles['wrapper--disabled']]
          .filter(Boolean)
          .join(' ')}
      >
        <input
          ref={inputRef}
          id={controlId}
          type="checkbox"
          className={styles.input}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          name={name}
          value={value}
          aria-describedby={error ? errorId : undefined}
        />
        <span className={styles.box} aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" className={styles.checkmark}>
            <path
              d="M3.5 8.5 6.5 11.5 12.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.indeterminateMark} aria-hidden="true" />
        </span>
        <span className={styles.label}>{label}</span>
      </label>
      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

Checkbox.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  indeterminate: PropTypes.bool,
  error: PropTypes.string,
  name: PropTypes.string,
  value: PropTypes.string,
};

Checkbox.defaultProps = {
  disabled: false,
  indeterminate: false,
  error: undefined,
  name: undefined,
  value: undefined,
};
