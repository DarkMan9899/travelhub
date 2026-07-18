/**
 * PublicLayout — chrome for the Customer Website route tree.
 * Implements FRONTEND_ARCHITECTURE.md §5.1.
 *
 * Sprint 1 scope: the minimal structural shell only (a header with the
 * platform name and an <Outlet />) — proving the layout/routing pipeline
 * renders correctly end-to-end. The full header (sticky search, language/
 * currency switcher, auth entry point), footer, and mobile navigation
 * described in FRONTEND_ARCHITECTURE.md §5.1 are built in a future
 * sprint alongside the real pages that need them.
 */

import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function PublicLayout() {
  const { t } = useTranslation();

  return (
    <div className="public-layout">
      <header className="public-layout__header">
        <span className="public-layout__logo">{t('app.name')}</span>
      </header>
      <main className="public-layout__content">
        <Outlet />
      </main>
    </div>
  );
}
