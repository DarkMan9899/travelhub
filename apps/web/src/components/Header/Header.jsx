/**
 * Header — reusable site header chrome.
 *
 * Lives in `src/components/` per FRONTEND_ARCHITECTURE.md §3.1: "shared
 * across more than one module but too domain-specific for `ui/`" —
 * PublicLayout uses the full header, CustomerAccountLayout uses "a
 * condensed version of PublicLayout's header" (§5.3), so this is built
 * once, composed with different `navItems`/`actions` per layout, rather
 * than re-implemented per layout (this sprint's "no duplicated layout
 * logic" requirement).
 *
 * Carries zero business logic itself (no auth state, no API calls) —
 * `navItems`/`actions` are supplied by the composing layout, keeping
 * this component a pure presentation shell.
 */

import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Container, Inline } from '@travelhub/ui/components/layout';
import styles from './Header.module.scss';

export default function Header({ logo, navItems, actions, homeHref }) {
  return (
    <header className={styles.header}>
      <Container size="wide">
        <Inline
          justify="space-between"
          gap="4"
          wrap={false}
          className={styles.bar}
        >
          <Link
            to={homeHref}
            className={styles.logo}
            aria-label={typeof logo === 'string' ? logo : undefined}
          >
            {logo}
          </Link>

          {navItems.length > 0 && (
            <nav aria-label="Primary" className={styles.nav}>
              <Inline as="ul" gap="6" wrap={false} className={styles.navList}>
                {navItems.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={styles.navLink}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </Inline>
            </nav>
          )}

          {actions && (
            <Inline gap="3" wrap={false} className={styles.actions}>
              {actions}
            </Inline>
          )}
        </Inline>
      </Container>
    </header>
  );
}

Header.propTypes = {
  logo: PropTypes.node.isRequired,
  homeHref: PropTypes.string,
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      to: PropTypes.string.isRequired,
    }),
  ),
  actions: PropTypes.node,
};

Header.defaultProps = {
  homeHref: '/',
  navItems: [],
  actions: undefined,
};
