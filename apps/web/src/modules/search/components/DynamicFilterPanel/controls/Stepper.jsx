/**
 * Stepper — the control for `input_type: 'STEPPER'` filters (e.g.
 * "bedrooms, 2+"). An "N or more" control, not an exact-value one: `0`
 * (or the definition's own `min`) means "no filter", so decrementing back
 * down clears the filter entirely rather than sending a no-op `_min=0`.
 *
 * Local to the search module (not `packages/ui`) — this is a narrow,
 * filter-specific shape (a bounded increment/decrement over a single
 * numeric bound with a trailing unit label), not a general-purpose form
 * control the rest of the app would reach for. Pure/presentational: all
 * display text is passed in already translated, so this component never
 * imports `useTranslation` itself — `FilterControl.jsx` is the one place
 * that resolves i18n keys for every control type.
 */

import PropTypes from 'prop-types';
import { Minus, Plus } from 'lucide-react';
import styles from './Stepper.module.scss';

export default function Stepper({
  label,
  unit = undefined,
  min = 0,
  max = undefined,
  value = undefined,
  onChange,
  anyLabel,
  decreaseAriaLabel,
  increaseAriaLabel,
}) {
  const current = value ?? min;
  const displayValue = value === undefined ? null : value;

  const decrement = () => {
    const next = current - 1;
    onChange(next <= min ? undefined : next);
  };

  const increment = () => {
    const next = current + 1;
    onChange(max !== undefined ? Math.min(next, max) : next);
  };

  return (
    <div className={styles.stepper}>
      <span className={styles.label}>{label}</span>
      <div className={styles.control}>
        <button
          type="button"
          className={styles.button}
          onClick={decrement}
          disabled={displayValue === null}
          aria-label={decreaseAriaLabel}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className={styles.value} aria-live="polite">
          {displayValue === null
            ? anyLabel
            : `${displayValue}+${unit ? ` ${unit}` : ''}`}
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={increment}
          disabled={max !== undefined && current >= max}
          aria-label={increaseAriaLabel}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

Stepper.propTypes = {
  label: PropTypes.string.isRequired,
  unit: PropTypes.string,
  min: PropTypes.number,
  max: PropTypes.number,
  value: PropTypes.number,
  onChange: PropTypes.func.isRequired,
  anyLabel: PropTypes.string.isRequired,
  decreaseAriaLabel: PropTypes.string.isRequired,
  increaseAriaLabel: PropTypes.string.isRequired,
};
