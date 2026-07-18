/**
 * Switch — COMPONENT_LIBRARY.md Part II §2 "Checkbox / Radio / Switch".
 * Pill-track toggle for immediate-effect settings (e.g. notification
 * preferences) rather than form-submitted booleans. `role="switch"` on a
 * native checkbox input is the standard accessible pattern for a control
 * with no dedicated native HTML element.
 */

import { useId } from 'react';
import PropTypes from 'prop-types';
import styles from './Switch.module.scss';

export default function Switch({ checked, onChange, label, disabled }) {
  const controlId = useId();
  const labelId = `${controlId}-label`;

  return (
    <label
      htmlFor={controlId}
      className={[styles.wrapper, disabled && styles['wrapper--disabled']]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        id={controlId}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-checked={checked}
        aria-labelledby={labelId}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
    </label>
  );
}

Switch.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
};

Switch.defaultProps = {
  disabled: false,
};
