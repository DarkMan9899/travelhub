/**
 * Sidebar — COMPONENT_LIBRARY.md Part II §3 "Sidebar Navigation".
 * The persistent dashboard navigation structure shared by
 * `PartnerLayout` and `AdminLayout` (`FRONTEND_ARCHITECTURE.md`
 * §5.4–5.5).
 *
 * Rendered as `<aside>` wrapping a `<nav>` — the `<aside>` is the
 * landmark for "this is the sidebar region", the `<nav>` inside it is
 * the landmark for "this is a navigation list", matching this sprint's
 * required semantic-landmark set without conflating the two roles.
 *
 * `collapsed` is controlled (the spec's "persisted per-user" is an
 * application-level concern — e.g. localStorage in the consuming app —
 * not this component's job); `onToggleCollapse` drives the built-in
 * toggle control.
 *
 * Simplification: the spec's Mobile/Tablet "bottom tab bar or slide-in
 * drawer" is implemented as a CSS-only reflow to a horizontal, bottom-
 * fixed bar, not a slide-in `Drawer` composition — the documented prop
 * API here has no open/close state for a drawer variant, and adding one
 * would be a materially different component; flagged rather than
 * silently built as a mismatched drawer integration.
 */

import PropTypes from 'prop-types';
import Button from '../../primitives/Button/Button.jsx';
import Badge from '../../primitives/Badge/Badge.jsx';
import styles from './Sidebar.module.scss';

function ChevronIcon({ collapsed }) {
  return (
    <svg
      className={[
        styles.toggleIcon,
        collapsed && styles['toggleIcon--collapsed'],
      ]
        .filter(Boolean)
        .join(' ')}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M10 3 5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
ChevronIcon.propTypes = { collapsed: PropTypes.bool.isRequired };

export default function Sidebar({
  items,
  collapsed,
  onToggleCollapse,
  activeItemId,
  linkComponent: Link,
  ariaLabel,
  className,
}) {
  const classNames = [
    styles.sidebar,
    collapsed && styles['sidebar--collapsed'],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <aside className={classNames}>
      <nav aria-label={ariaLabel} className={styles.nav}>
        {items.map((group) => (
          <div key={group.id} className={styles.group}>
            {group.label && !collapsed && (
              <p className={styles.groupLabel}>{group.label}</p>
            )}
            <ul className={styles.list}>
              {group.items.map((item) => {
                const isActive = item.id === activeItemId;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={[
                        styles.item,
                        isActive && styles['item--active'],
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {item.icon && (
                        <span className={styles.icon} aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      {!collapsed && (
                        <span className={styles.label}>{item.label}</span>
                      )}
                      {!collapsed &&
                        typeof item.badgeCount === 'number' &&
                        item.badgeCount > 0 && (
                          <span className={styles.badge}>
                            <Badge
                              variant="info"
                              size="sm"
                              filled
                              label={String(item.badgeCount)}
                            />
                          </span>
                        )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      {onToggleCollapse && (
        <Button
          variant="ghost"
          size="sm"
          ariaLabel={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
          iconLeft={<ChevronIcon collapsed={collapsed} />}
        />
      )}
    </aside>
  );
}

Sidebar.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string,
      items: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string.isRequired,
          label: PropTypes.string.isRequired,
          href: PropTypes.string.isRequired,
          icon: PropTypes.node,
          badgeCount: PropTypes.number,
        }),
      ).isRequired,
    }),
  ).isRequired,
  collapsed: PropTypes.bool,
  onToggleCollapse: PropTypes.func,
  activeItemId: PropTypes.string,
  linkComponent: PropTypes.elementType,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
};

Sidebar.defaultProps = {
  collapsed: false,
  onToggleCollapse: undefined,
  activeItemId: undefined,
  linkComponent: 'a',
  ariaLabel: 'Dashboard navigation',
  className: undefined,
};
