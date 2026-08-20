/**
 * PartnerLayout — FRONTEND_ARCHITECTURE.md §5.4: same sidebar mechanics
 * as `CustomerAccountLayout`, Wide container. Phase 9 (Partner Dashboard)
 * fills out the nav with the four routes that now actually exist
 * (Overview/Listings/Bookings/Calendar) and adopts
 * `CustomerAccountLayout`'s longest-matching-prefix `activeItemId` logic
 * (this phase adds nested routes like `partner/bookings/:id`, which the
 * previous exact-match check would never highlight).
 *
 * Composed behind `RequireAuth` + `RequirePartner` (`routes/index.jsx`).
 * Phase 5 added the `partners` backend module and `AuthContext`'s
 * `partnerships` field specifically to make `RequirePartner` a real
 * partner-membership check — this layout previously flagged that no such
 * check was possible yet; that limitation is resolved.
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
import styles from './PartnerLayout.module.scss';

export default function PartnerLayout() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const location = useLocation();
  useNoIndex();

  const navItems = [
    {
      id: 'dashboard',
      label: t('partner.nav.dashboard'),
      href: `/${locale}/partner`,
    },
    {
      id: 'listings',
      label: t('partner.nav.listings'),
      href: `/${locale}/partner/listings`,
    },
    {
      id: 'bookings',
      label: t('partner.nav.bookings'),
      href: `/${locale}/partner/bookings`,
    },
    {
      id: 'calendar',
      label: t('partner.nav.calendar'),
      href: `/${locale}/partner/calendar`,
    },
    {
      id: 'connections',
      label: t('partner.nav.connections'),
      href: `/${locale}/partner/connections`,
    },
    {
      id: 'profile',
      label: t('partner.nav.profile'),
      href: `/${locale}/partner/profile`,
    },
    {
      id: 'messages',
      label: t('partner.nav.messages'),
      href: `/${locale}/partner/messages`,
    },
    {
      id: 'notifications',
      label: t('partner.nav.notifications'),
      href: `/${locale}/partner/notifications`,
    },
    {
      id: 'ai-usage',
      label: t('partner.nav.aiUsage'),
      href: `/${locale}/partner/ai/usage`,
    },
  ];

  // Longest-matching-prefix, not exact match — mirrors
  // `CustomerAccountLayout`'s own logic exactly, for the same reason: a
  // nested route (`partner/bookings/:id`) still highlights its owning
  // nav item, and reverse order + `find` makes the most specific href
  // win over `partner/bookings` matching `partner/bookings/:id`'s prefix
  // (and, at the far end, `dashboard`'s href never wrongly wins since
  // every other href is checked first).
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
          items={[{ id: 'partner', items: navItems }]}
          activeItemId={activeItemId}
          linkComponent={RouterLink}
          ariaLabel={t('nav.partner')}
          className={styles.sidebar}
        />
        <div className={styles.content}>
          <Outlet />
        </div>
      </Container>
    </AppLayout>
  );
}
