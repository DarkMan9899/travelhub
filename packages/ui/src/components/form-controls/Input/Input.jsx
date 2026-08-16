/**
 * Input — COMPONENT_LIBRARY.md Part II §2 "Input".
 *
 * Controlled exclusively (FRONTEND_ARCHITECTURE.md §8.2): `value` and
 * `onChange` are both required so a parent always owns and can validate
 * the current field state (e.g. via React Hook Form's `Controller`).
 *
 * Any prop not named below (`onKeyDown`, `role`, `aria-*`, `autoComplete`,
 * ...) is forwarded straight to the native `<input>` — the same
 * polymorphic-forwarding rationale the `layout` primitives already use
 * (see `Stack.jsx`'s file header), needed here for consumers building a
 * combobox/autocomplete on top of this field without re-implementing its
 * label/error/icon chrome.
 */

import PropTypes from 'prop-types';
import FieldWrapper from '../internal/FieldWrapper.jsx';
import styles from './Input.module.scss';

const SIZES = ['sm', 'md', 'lg'];
const TYPES = ['text', 'email', 'password', 'number', 'tel'];

export default function Input({
  value,
  onChange,
  onBlur = undefined,
  onFocus = undefined,
  label = undefined,
  placeholder = undefined,
  helperText = undefined,
  error = undefined,
  size = 'md',
  disabled = false,
  iconLeft = undefined,
  iconRight = undefined,
  type = 'text',
  id = undefined,
  name = undefined,
  required = false,
  ...rest
}) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      required={required}
      disabled={disabled}
      size={size}
      error={error}
      helperText={helperText}
    >
      {({ id: fieldId, describedBy }) => (
        <span
          className={[
            styles.inputWrapper,
            styles[`inputWrapper--${size}`],
            error && styles['inputWrapper--error'],
            disabled && styles['inputWrapper--disabled'],
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {iconLeft && (
            <span className={styles.icon} aria-hidden="true">
              {iconLeft}
            </span>
          )}
          <input
            id={fieldId}
            name={name}
            type={type}
            className={styles.input}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            onFocus={onFocus}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describedBy}
            // See file header: forwards arbitrary DOM attributes/handlers.
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...rest}
          />
          {iconRight && (
            <span className={styles.icon} aria-hidden="true">
              {iconRight}
            </span>
          )}
        </span>
      )}
    </FieldWrapper>
  );
}

Input.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  helperText: PropTypes.string,
  error: PropTypes.string,
  size: PropTypes.oneOf(SIZES),
  disabled: PropTypes.bool,
  iconLeft: PropTypes.node,
  iconRight: PropTypes.node,
  type: PropTypes.oneOf(TYPES),
  id: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
};
export { SIZES as INPUT_SIZES, TYPES as INPUT_TYPES };
