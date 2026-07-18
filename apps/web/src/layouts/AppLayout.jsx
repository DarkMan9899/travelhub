/**
 * AppLayout — generic page-shell primitive.
 *
 * Not one of FRONTEND_ARCHITECTURE.md §5's seven named layouts
 * (PublicLayout, AuthLayout, CustomerAccountLayout, PartnerLayout,
 * AdminLayout, CheckoutLayout, ErrorLayout) — it is the shared chrome
 * scaffold those compose from: skip-link, optional header, `<main>`
 * landmark, optional footer. §5's own framing note ("Every layout is
 * chrome only — header, footer, sidebar, breadcrumb, and a content
 * outlet — never business logic") describes exactly this shape, common
 * to all seven; centralizing it here is what satisfies this sprint's
 * "no duplicated layout logic" requirement — PublicLayout composes it
 * below instead of hand-rolling its own header/main scaffold as it did
 * in Sprint 1.
 *
 * Router-agnostic on purpose: it takes `children` rather than rendering
 * `<Outlet />` itself, so it works as a plain wrapper anywhere, not only
 * as a route element. The composing layout (e.g. PublicLayout) is the
 * one that knows about react-router.
 */

import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import styles from './AppLayout.module.scss';

export default function AppLayout({ header, footer, children }) {
  const { t } = useTranslation();

  return (
    <div className={styles.appLayout}>
      <a href="#main-content" className={styles.skipLink}>
        {t('a11y.skipToContent')}
      </a>
      {header}
      <main id="main-content" className={styles.main} tabIndex={-1}>
        {children}
      </main>
      {footer}
    </div>
  );
}

AppLayout.propTypes = {
  header: PropTypes.node,
  footer: PropTypes.node,
  children: PropTypes.node.isRequired,
};

AppLayout.defaultProps = {
  header: undefined,
  footer: undefined,
};
