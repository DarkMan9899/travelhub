/**
 * PublicLayout — chrome for the Customer Website route tree.
 * Implements FRONTEND_ARCHITECTURE.md §5.1.
 *
 * Sprint 4 refactor: composes the new `AppLayout` shell + `Header`/
 * `Footer` (this sprint's Layout System) instead of hand-rolling its own
 * header/main markup as it did in Sprint 1 — removing the duplication
 * this sprint's "no duplicated layout logic" requirement calls out.
 *
 * Still a minimal chrome relative to the full §5.1 spec: sticky search,
 * currency switcher, auth entry point, footer link columns, and mobile
 * navigation are real content/business decisions for a future sprint
 * that has the modules/pages needing them — this sprint only had to
 * prove the shell composes correctly, not populate its business content.
 */

import { Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppLayout from './AppLayout.jsx';
import Header from '../components/Header/Header.jsx';
import Footer from '../components/Footer/Footer.jsx';

export default function PublicLayout() {
  const { t } = useTranslation();
  const { locale } = useParams();

  const navItems = [
    { label: t('nav.home'), to: `/${locale}` },
    { label: t('nav.search'), to: `/${locale}/search` },
  ];

  return (
    <AppLayout
      header={
        <Header
          logo={t('app.name')}
          homeHref={`/${locale}`}
          navItems={navItems}
        />
      }
      footer={
        <Footer bottomText={`© ${new Date().getFullYear()} ${t('app.name')}`} />
      }
    >
      <Outlet />
    </AppLayout>
  );
}
