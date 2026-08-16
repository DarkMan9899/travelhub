/**
 * Label — not a separate entry in COMPONENT_LIBRARY.md Part II §2, but
 * required by every form control documented there: Input, Textarea, and
 * Select/Dropdown all specify "label (always visible, never
 * placeholder-only)" and "programmatically associated via htmlFor/id"
 * (COMPONENT_LIBRARY.md's Input Accessibility clause). This is the one
 * shared implementation of that requirement so it is never re-built
 * per-field, per FRONTEND_ARCHITECTURE.md §8's "never re-implemented
 * locally" rule. Input/Textarea/Checkbox/Radio/Switch/Select all render
 * this internally; it is also exported for standalone composition.
 */

import PropTypes from 'prop-types';
import styles from './Label.module.scss';

const SIZES = ['sm', 'md', 'lg'];

export default function Label({
  htmlFor = undefined,
  id = undefined,
  children,
  required = false,
  disabled = false,
  size = 'md',
}) {
  const className = [
    styles.label,
    styles[`label--${size}`],
    disabled && styles['label--disabled'],
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label htmlFor={htmlFor} id={id} className={className}>
      {children}
      {required && (
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}

Label.propTypes = {
  htmlFor: PropTypes.string,
  // Lets a consumer reference this label via `aria-labelledby` — needed
  // for custom widgets (e.g. Select's `role="button"` trigger) where
  // `htmlFor`/`for` has no effect, since `for` only establishes an
  // accessible-name relationship for actual labelable HTML elements
  // (input/select/textarea/button/...), never a plain `<div>`.
  id: PropTypes.string,
  children: PropTypes.node.isRequired,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
  size: PropTypes.oneOf(SIZES),
};

export { SIZES as LABEL_SIZES };
