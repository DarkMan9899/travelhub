/**
 * Breadcrumbs — COMPONENT_LIBRARY.md Part II §3 "Breadcrumb".
 *
 * `linkComponent` (default `'a'`) lets a consuming app inject its
 * router's link component without this package taking a dependency on
 * any router — packages/ui stays framework-agnostic beyond React
 * itself. It is always given an `href` prop; a router link (e.g.
 * react-router-dom's `Link`, which expects `to`) needs a small local
 * adapter component in the consuming app translating `href` → `to`.
 *
 * Simplification: the spec's mobile-specific "truncates to first + last
 * + ellipsis" and the general `maxItems` collapse are unified into one
 * `maxItems`-driven algorithm (first item + ellipsis + last
 * `maxItems - 1` items) applied at every breakpoint, rather than two
 * separate rules — one JS code path is simpler and strictly more
 * predictable than a breakpoint-conditional one, at the cost of desktop
 * showing the same collapsed form mobile would if `maxItems` is set low.
 * The ellipsis itself is static (non-interactive), not an expandable
 * menu, since no shared Dropdown/Menu primitive exists yet to compose it
 * from — see packages/ui/README.md's Sprint 4 section.
 */

import PropTypes from 'prop-types';
import styles from './Breadcrumbs.module.scss';

function ChevronSeparator() {
  return (
    <svg
      className={styles.separator}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function collapseItems(items, maxItems) {
  if (items.length <= maxItems) return items;
  const lastCount = Math.max(maxItems - 1, 1);
  const tail = items.slice(items.length - lastCount);
  return [items[0], null, ...tail];
}

export default function Breadcrumbs({
  items,
  maxItems,
  linkComponent: Link,
  className,
}) {
  const visibleItems = collapseItems(items, maxItems);

  return (
    <nav
      aria-label="Breadcrumb"
      className={[styles.breadcrumbs, className].filter(Boolean).join(' ')}
    >
      <ol className={styles.list}>
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;
          const isEllipsis = item === null;

          return (
            <li
              // eslint-disable-next-line react/no-array-index-key -- items
              // may legitimately repeat labels/hrefs (e.g. two "Settings"
              // crumbs in different sections); index is the stable identity.
              key={isEllipsis ? `ellipsis-${index}` : `${item.href}-${index}`}
              className={styles.item}
            >
              {isEllipsis && (
                <span className={styles.ellipsis} aria-hidden="true">
                  …
                </span>
              )}
              {!isEllipsis && isLast && (
                <span className={styles.current} aria-current="page">
                  {item.label}
                </span>
              )}
              {!isEllipsis && !isLast && (
                <Link href={item.href} className={styles.link}>
                  {item.label}
                </Link>
              )}
              {!isLast && <ChevronSeparator />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumbs.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string.isRequired,
    }),
  ).isRequired,
  maxItems: PropTypes.number,
  linkComponent: PropTypes.elementType,
  className: PropTypes.string,
};

Breadcrumbs.defaultProps = {
  maxItems: 4,
  linkComponent: 'a',
  className: undefined,
};
