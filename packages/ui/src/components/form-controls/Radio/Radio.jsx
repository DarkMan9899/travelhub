/**
 * Radio — COMPONENT_LIBRARY.md Part II §2 "Checkbox / Radio / Switch".
 * Native <input type="radio">, "used in groups sharing one name"
 * (COMPONENT_LIBRARY.md's Radio Variant clause) — `name` and `value` are
 * therefore required here even though they aren't in the shared prop
 * shape list, since native radio grouping cannot function without them.
 * Grouping/selection state itself is owned by the consumer (no separate
 * RadioGroup composition exists in this catalog entry).
 */

import { useId } from 'react';
import PropTypes from 'prop-types';
import styles from './Radio.module.scss';

export default function Radio({
  checked,
  onChange,
  label,
  disabled,
  error,
  name,
  value,
}) {
  const controlId = useId();
  const errorId = `${controlId}-error`;

  return (
    <div className={styles.field}>
      <label
        htmlFor={controlId}
        className={[styles.wrapper, disabled && styles['wrapper--disabled']]
          .filter(Boolean)
          .join(' ')}
      >
        <input
          id={controlId}
          type="radio"
          className={styles.input}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          name={name}
          value={value}
          aria-describedby={error ? errorId : undefined}
        />
        <span className={styles.circle} aria-hidden="true">
          <span className={styles.dot} />
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

Radio.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  error: PropTypes.string,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

Radio.defaultProps = {
  disabled: false,
  error: undefined,
};
