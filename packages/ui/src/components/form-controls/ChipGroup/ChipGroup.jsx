/**
 * ChipGroup — a single-select group of toggle-button "chips", the
 * button/pill alternative to `Select` for a small, always-visible set of
 * mutually exclusive options (COMPONENT_LIBRARY.md Part II §2's "prefer
 * chips over a dropdown when every option should be scannable at a
 * glance" guidance). `role="group"` + one `<button aria-pressed>` per
 * option — native button focus/keyboard support, no roving-tabindex
 * machinery needed.
 *
 * Promoted from `apps/web/src/modules/search/components/DynamicFilterPanel/
 * controls/ChipGroup.jsx` (built for `SINGLE_SELECT` search filters —
 * star rating, difficulty) into this shared package once the Marketplace
 * Product Completeness Sprint A time-slot picker
 * (`ListingReservationWidget`) needed the exact same control — verbatim,
 * not a second implementation. Clicking the already-selected chip
 * deselects it (`onChange(undefined)`), the same "radio group that allows
 * 'none chosen'" behavior the search filter panel already relies on.
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
              disabled={option.disabled}
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
      label: PropTypes.node.isRequired,
      disabled: PropTypes.bool,
    }),
  ).isRequired,
  selectedValue: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
