/**
 * Textarea — COMPONENT_LIBRARY.md Part II §2 "Textarea".
 * "identical to Input" for States/Accessibility/Animation, built on the
 * same FieldWrapper base as Input (see that component's file header).
 */

import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import FieldWrapper from '../internal/FieldWrapper.jsx';
import styles from './Textarea.module.scss';

const SIZES = ['sm', 'md', 'lg'];

export default function Textarea({
  value,
  onChange,
  onBlur,
  onFocus,
  label,
  placeholder,
  helperText,
  error,
  size,
  disabled,
  rows,
  autoResize,
  id,
  name,
  required,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!autoResize || !textareaRef.current) return;
    const el = textareaRef.current;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value, autoResize]);

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
        <textarea
          ref={textareaRef}
          id={fieldId}
          name={name}
          rows={rows}
          className={[
            styles.textarea,
            styles[`textarea--${size}`],
            error && styles['textarea--error'],
            autoResize && styles['textarea--auto-resize'],
          ]
            .filter(Boolean)
            .join(' ')}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
        />
      )}
    </FieldWrapper>
  );
}

Textarea.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  label: PropTypes.string,
  placeholder: PropTypes.string,
  helperText: PropTypes.string,
  error: PropTypes.string,
  size: PropTypes.oneOf(SIZES),
  disabled: PropTypes.bool,
  rows: PropTypes.number,
  autoResize: PropTypes.bool,
  id: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
};

Textarea.defaultProps = {
  onBlur: undefined,
  onFocus: undefined,
  label: undefined,
  placeholder: undefined,
  helperText: undefined,
  error: undefined,
  size: 'md',
  disabled: false,
  rows: 4,
  autoResize: false,
  id: undefined,
  name: undefined,
  required: false,
};

export { SIZES as TEXTAREA_SIZES };
