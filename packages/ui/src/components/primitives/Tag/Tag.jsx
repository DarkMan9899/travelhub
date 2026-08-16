/**
 * Tag — COMPONENT_LIBRARY.md Part II §1 "Tag". Removable categorization
 * chip, distinct from Badge (status) by supporting a remove action.
 */

import PropTypes from 'prop-types';
import styles from './Tag.module.scss';

const SIZES = ['sm', 'md'];
const VARIANTS = ['standard', 'selected'];

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M3 3l6 6M9 3l-6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Tag({
  label,
  onRemove = undefined,
  size = 'md',
  selected = false,
  getRemoveLabel = (tagLabel) => `Remove ${tagLabel}`,
}) {
  return (
    <span
      className={[
        styles.tag,
        styles[`tag--${size}`],
        selected && styles['tag--selected'],
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          className={styles.remove}
          aria-label={getRemoveLabel(label)}
          onClick={onRemove}
        >
          <CloseIcon />
        </button>
      )}
    </span>
  );
}

Tag.propTypes = {
  label: PropTypes.string.isRequired,
  onRemove: PropTypes.func,
  size: PropTypes.oneOf(SIZES),
  selected: PropTypes.bool,
  getRemoveLabel: PropTypes.func,
};

export { SIZES as TAG_SIZES, VARIANTS as TAG_VARIANTS };
