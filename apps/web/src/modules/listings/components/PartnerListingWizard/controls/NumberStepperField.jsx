/**
 * NumberStepperField — the "Number inputs / Stepper controls" branch of
 * `MetadataFieldRenderer` (INTEGER/DECIMAL attributes — bedrooms,
 * bathrooms, seats, duration, group size, ...). Not
 * `@desavii/ui`'s primitive registry: it's a thin composition of
 * `Label` + `Button` (both reused as-is, no forked copies) around a
 * plain native number input, since neither primitive exposes an
 * interactive-icon slot — `Input`'s `iconLeft`/`iconRight` are wrapped
 * `aria-hidden="true"` (decorative-icon only, per that component's own
 * implementation), so a real +/- button can't live there without
 * becoming a keyboard/screen-reader trap.
 */

import { useId } from 'react';
import PropTypes from 'prop-types';
import { Label } from '@desavii/ui/components/form-controls';
import { Button } from '@desavii/ui/components/primitives';
import styles from './NumberStepperField.module.scss';

export default function NumberStepperField({
  label,
  unit = undefined,
  min = undefined,
  max = undefined,
  step = 1,
  value = undefined,
  onChange,
  error = undefined,
  required = false,
  disabled = false,
  decreaseAriaLabel,
  increaseAriaLabel,
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const current = value ?? min ?? 0;

  function clamp(next) {
    if (!Number.isFinite(next)) return;
    let result = next;
    if (min != null) result = Math.max(min, result);
    if (max != null) result = Math.min(max, result);
    onChange(result);
  }

  return (
    <div className={styles.field}>
      <Label htmlFor={fieldId} required={required} disabled={disabled}>
        {label}
      </Label>
      <div className={styles.row}>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || (min != null && current <= min)}
          ariaLabel={decreaseAriaLabel}
          onClick={() => clamp(current - step)}
        >
          −
        </Button>
        <input
          id={fieldId}
          type="number"
          className={styles.input}
          value={current}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? 'true' : undefined}
          onChange={(event) => clamp(Number(event.target.value))}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || (max != null && current >= max)}
          ariaLabel={increaseAriaLabel}
          onClick={() => clamp(current + step)}
        >
          +
        </Button>
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>
      {error && (
        <p id={errorId} className={styles.errorText} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

NumberStepperField.propTypes = {
  label: PropTypes.string.isRequired,
  unit: PropTypes.string,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  error: PropTypes.string,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  decreaseAriaLabel: PropTypes.string.isRequired,
  increaseAriaLabel: PropTypes.string.isRequired,
};
