/**
 * Icon — COMPONENT_LIBRARY.md Part II §1 "Icon".
 *
 * The doc specifies a closed `name` set; every real call site in this
 * codebase instead passes a `lucide-react` component reference directly
 * (`icon={ChevronDown}`) — the platform's actual icon family is already
 * `lucide-react` (see `Button`'s own `iconLeft`/`iconRight` doc note),
 * so this wraps that component reference for consistent sizing/color
 * rather than re-introducing a separate closed name registry.
 *
 * `label` (not `aria-label`) is this component's own prop for the
 * "real `aria-label` only when used alone as the sole content of an
 * interactive element" case (COMPONENT_LIBRARY.md's Icon accessibility
 * clause) — matching `Badge`'s `label` convention rather than asking
 * every call site to reach for a raw `aria-*` prop. When present, the
 * icon becomes a real accessible element (`role="img"`, not
 * `aria-hidden`); otherwise it defaults to decorative/`aria-hidden`.
 */

import PropTypes from 'prop-types';
import styles from './Icon.module.scss';

const SIZES = ['sm', 'md', 'lg', 'xl'];

export default function Icon({
  icon: IconComponent,
  size = 'lg',
  color = undefined,
  label = undefined,
}) {
  return (
    <IconComponent
      className={styles[`icon--${size}`]}
      style={color ? { color } : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    />
  );
}

Icon.propTypes = {
  icon: PropTypes.elementType.isRequired,
  size: PropTypes.oneOf(SIZES),
  color: PropTypes.string,
  label: PropTypes.string,
};

export { SIZES as ICON_SIZES };
