/**
 * CustomerAccountLayout — FRONTEND_ARCHITECTURE.md §5.3: persistent
 * sidebar (Bookings, Profile, Favorites, Trip Planner, Messages,
 * Notifications, Settings, plus an Overview landing item) and a condensed
 * header. Phase 12 (Product Polish) added Favorites; Phase 13 added
 * Notifications; Phase 14 added Messages; Phase 15 added Trip Planner,
 * once each module was real. Wallet stays out — its backend module still
 * doesn't exist. Composed behind `RequireAuth`
 * at the route level (`routes/index.jsx`), not here — this component
 * assumes an authenticated session.
 */

import { Outlet, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '@travelhub/ui/components/navigation';
import { Container } from '@travelhub/ui/components/layout';
import AppLayout from './AppLayout.jsx';
import Header from '../components/Header/Header.jsx';
import UserMenu from '../components/UserMenu/UserMenu.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher/LanguageSwitcher.jsx';
import RouterLink from '../components/RouterLink.jsx';
import { NotificationBell } from '../modules/notifications/index.js';
import { MessagingBell } from '../modules/messaging/index.js';
import { AiAssistantTrigger } from '../modules/ai/index.js';
import useNoIndex from '../seo/useNoIndex.js';
import styles from './CustomerAccountLayout.module.scss';

export default function CustomerAccountLayout() {
  useNoIndex();
  const { t } = useTranslation();
  const { locale } = useParams();
  const location = useLocation();

  const navItems = [
    {
      id: 'dashboard',
      label: t('account.nav.dashboard'),
      href: `/${locale}/account`,
    },
    {
      id: 'bookings',
      label: t('account.nav.bookings'),
      href: `/${locale}/account/bookings`,
    },
    {
      id: 'payments',
      label: t('account.nav.payments'),
      href: `/${locale}/account/payments`,
    },
    {
      id: 'profile',
      label: t('account.nav.profile'),
      href: `/${locale}/account/profile`,
    },
    {
      id: 'favorites',
      label: t('account.nav.favorites'),
      href: `/${locale}/account/favorites`,
    },
    {
      id: 'trip-planner',
      label: t('account.nav.tripPlanner'),
      href: `/${locale}/account/trip-planner`,
    },
    {
      id: 'messages',
      label: t('account.nav.messages'),
      href: `/${locale}/account/messages`,
    },
    {
      id: 'notifications',
      label: t('account.nav.notifications'),
      href: `/${locale}/account/notifications`,
    },
    {
      id: 'settings',
      label: t('account.nav.settings'),
      href: `/${locale}/account/settings`,
    },
  ];

  // Longest-matching-prefix, not exact match — a nested route like
  // `account/bookings/:id` (or any future sub-route) still highlights its
  // owning nav item. Reverse order + `find` so the most specific href
  // wins over `account` itself (every path is prefixed by it).
  const activeItemId = [...navItems]
    .reverse()
    .find(
      (item) =>
        location.pathname === item.href ||
        location.pathname.startsWith(`${item.href}/`),
    )?.id;

  return (
    <AppLayout
      header={
        <Header
          logo={t('app.name')}
          homeHref={`/${locale}`}
          actions={
            <>
              <LanguageSwitcher />
              <MessagingBell />
              <NotificationBell />
              <AiAssistantTrigger />
              <UserMenu />
            </>
          }
        />
      }
    >
      <Container size="wide" className={styles.body}>
        <Sidebar
          items={[{ id: 'account', items: navItems }]}
          activeItemId={activeItemId}
          linkComponent={RouterLink}
          ariaLabel={t('nav.account')}
          className={styles.sidebar}
        />
        <div className={styles.content}>
          <Outlet />
        </div>
      </Container>
    </AppLayout>
  );
}
