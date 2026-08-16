/**
 * RangeSlider — the control for `input_type: 'RANGE'` filters (e.g.
 * "tour duration, 30–180 minutes"). Two overlaid native
 * `<input type="range">` elements sharing one `min`/`max` — the standard
 * dual-thumb technique: each input is transparent and only its own thumb
 * accepts pointer events (`Stepper.module.scss`'s sibling,
 * `RangeSlider.module.scss`, sets `pointer-events: none` on the track and
 * re-enables it on `::-webkit-slider-thumb`/`::-moz-range-thumb`), so
 * both stay independently draggable without a drag-and-drop library.
 * A separate `.track`/`.fill` pair renders the visual bar and highlighted
 * selected segment, positioned purely from the current values as
 * percentages.
 *
 * Local to the search module — no dual-range primitive exists in
 * `packages/ui` yet, and this control's semantics (two bounds committing
 * to two distinct query params) are specific to this filter model.
 */

import PropTypes from 'prop-types';
import styles from './RangeSlider.module.scss';

function toPercent(value, min, max) {
  if (max === min) return 0;
  return ((value - min) / (max - min)) * 100;
}

export default function RangeSlider({
  label,
  unit = undefined,
  min,
  max,
  valueMin,
  valueMax,
  onChange,
  minAriaLabel,
  maxAriaLabel,
}) {
  const fillStart = toPercent(valueMin, min, max);
  const fillEnd = toPercent(valueMax, min, max);

  const handleMinChange = (event) => {
    const next = Math.min(Number(event.target.value), valueMax);
    onChange(next, valueMax);
  };

  const handleMaxChange = (event) => {
    const next = Math.max(Number(event.target.value), valueMin);
    onChange(valueMin, next);
  };

  return (
    <div className={styles.rangeSlider}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        <span className={styles.values}>
          {valueMin}
          {unit ? ` ${unit}` : ''} – {valueMax}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{ left: `${fillStart}%`, right: `${100 - fillEnd}%` }}
        />
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          value={valueMin}
          onChange={handleMinChange}
          aria-label={minAriaLabel}
        />
        <input
          type="range"
          className={styles.input}
          min={min}
          max={max}
          value={valueMax}
          onChange={handleMaxChange}
          aria-label={maxAriaLabel}
        />
      </div>
    </div>
  );
}

RangeSlider.propTypes = {
  label: PropTypes.string.isRequired,
  unit: PropTypes.string,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
  valueMin: PropTypes.number.isRequired,
  valueMax: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  minAriaLabel: PropTypes.string.isRequired,
  maxAriaLabel: PropTypes.string.isRequired,
};
