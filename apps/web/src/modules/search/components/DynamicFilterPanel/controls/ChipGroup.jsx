/**
 * ChipGroup — the control for `input_type: 'SINGLE_SELECT'` filters (e.g.
 * star rating, difficulty). Clicking the already-selected chip deselects
 * it (toggles the filter off entirely) rather than requiring a separate
 * "clear" action — the same single-select-with-toggle-off pattern as a
 * radio group that allows "none chosen".
 */

import PropTypes from 'prop-types';
import styles from './ChipGroup.module.scss';

export default function ChipGroup({
  label,
  options,
  selectedValue = undefined,
  onChange,
}) {
  return (
    <div className={styles.chipGroup}>
      <span className={styles.label}>{label}</span>
      <div className={styles.chips} role="group" aria-label={label}>
        {options.map((option) => {
          const isSelected = option.value === selectedValue;
          return (
            <button
              key={option.value}
              type="button"
              className={[styles.chip, isSelected && styles['chip--selected']]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={isSelected}
              onClick={() => onChange(isSelected ? undefined : option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

ChipGroup.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    }),
  ).isRequired,
  selectedValue: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
