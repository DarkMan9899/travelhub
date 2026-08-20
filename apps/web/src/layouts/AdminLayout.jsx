/**
 * AdminLayout — Phase 11 Admin Platform. Structurally identical to
 * `PartnerLayout` (same `Sidebar`/`Header`/`Container size="wide"`
 * mechanics, same longest-matching-prefix `activeItemId` logic) — no new
 * layout paradigm invented. Breadcrumbs are per-page via `PageHeader`,
 * same as every other dashboard-style layout in this app.
 *
 * Composed behind `RequireAuth` + `RequireRole` (`routes/index.jsx`) —
 * no `PartnerProvider`-equivalent context is needed here: there is no
 * "which one of several admin orgs" concept to switch between.
 *
 * Nav items whose page is a plain role-only read (Dashboard, Partners,
 * Marketplace Config, CMS, System Health, Settings, Messages,
 * Notifications) are shown unconditionally to every admin-area role — a
 * SUPPORT/MODERATOR user who lacks the permission for that page's
 * *mutations* still sees the nav entry and a real read-only view;
 * per-action gating for those happens inside each page (a disabled/
 * absent "Suspend" button), not by hiding the nav.
 *
 * Phase 14.10 cleanup: several pages' underlying *read* endpoint is
 * itself permission-gated, not just role-gated (`GET /users` needs
 * `user.list`, `GET /bookings?viewAll=true` needs `booking.view_all`,
 * `GET /admin/audit-logs` needs `audit.view`, `GET /listings/admin`
 * needs `listing.moderate`) — MODERATOR lacks the first three, SUPPORT
 * lacks the fourth. Showing those nav entries to a role that can't even
 * load the page is a dead end, not a legitimate read-only view, so those
 * are filtered by `requiredPermission` below instead. Stage 15.6 adds two
 * more of the same shape: `GET /ai/admin/moderation-queue` needs
 * `ai.admin_tools`, `GET /ai/admin/usage` needs `ai.usage_view`.
 *
 * Phase 11 ships in stages (11.0 Dashboard, 11.1 Users, 11.2 Partners,
 * ...) — a nav item is added here only once its route actually exists,
 * never ahead of time as a dead link.
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
import { useAuth } from '../contexts/AuthContext.jsx';
import { NotificationBell } from '../modules/notifications/index.js';
import { MessagingBell } from '../modules/messaging/index.js';
import { AiAssistantTrigger } from '../modules/ai/index.js';
import useNoIndex from '../seo/useNoIndex.js';
import styles from './AdminLayout.module.scss';

export default function AdminLayout() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const location = useLocation();
  const { permissions } = useAuth();
  useNoIndex();

  const allNavItems = [
    {
      id: 'dashboard',
      label: t('admin.nav.dashboard'),
      href: `/${locale}/admin`,
    },
    {
      id: 'users',
      label: t('admin.nav.users'),
      href: `/${locale}/admin/users`,
      requiredPermission: 'user.list',
    },
    {
      id: 'partners',
      label: t('admin.nav.partners'),
      href: `/${locale}/admin/partners`,
    },
    {
      id: 'listings',
      label: t('admin.nav.listings'),
      href: `/${locale}/admin/listings`,
      requiredPermission: 'listing.moderate',
    },
    {
      id: 'reviews',
      label: t('admin.nav.reviews'),
      href: `/${locale}/admin/reviews`,
      requiredPermission: 'review.moderate',
    },
    {
      id: 'inventory',
      label: t('admin.nav.inventory'),
      href: `/${locale}/admin/inventory`,
      requiredPermission: 'inventory.view_all',
    },
    {
      id: 'bookings',
      label: t('admin.nav.bookings'),
      href: `/${locale}/admin/bookings`,
      requiredPermission: 'booking.view_all',
    },
    {
      id: 'payments',
      label: t('admin.nav.payments'),
      href: `/${locale}/admin/payments`,
      requiredPermission: 'payment.view',
    },
    {
      id: 'marketplace-config',
      label: t('admin.nav.marketplaceConfig'),
      href: `/${locale}/admin/marketplace-config`,
    },
    {
      id: 'cms',
      label: t('admin.nav.cms'),
      href: `/${locale}/admin/cms`,
    },
    {
      id: 'audit-logs',
      label: t('admin.nav.auditLogs'),
      href: `/${locale}/admin/audit-logs`,
      requiredPermission: 'audit.view',
    },
    {
      id: 'system-health',
      label: t('admin.nav.systemHealth'),
      href: `/${locale}/admin/system-health`,
    },
    {
      id: 'settings',
      label: t('admin.nav.settings'),
      href: `/${locale}/admin/settings`,
    },
    {
      id: 'ai-moderation',
      label: t('admin.nav.aiModeration'),
      href: `/${locale}/admin/ai/moderation`,
      requiredPermission: 'ai.admin_tools',
    },
    {
      id: 'ai-usage',
      label: t('admin.nav.aiUsage'),
      href: `/${locale}/admin/ai/usage`,
      requiredPermission: 'ai.usage_view',
    },
    {
      id: 'messages',
      label: t('admin.nav.messages'),
      href: `/${locale}/admin/messages`,
    },
    {
      id: 'notifications',
      label: t('admin.nav.notifications'),
      href: `/${locale}/admin/notifications`,
    },
  ];

  const navItems = allNavItems.filter(
    (item) =>
      !item.requiredPermission || permissions.includes(item.requiredPermission),
  );

  // Longest-matching-prefix, mirroring `PartnerLayout`/
  // `CustomerAccountLayout` exactly.
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
          items={[{ id: 'admin', items: navItems }]}
          activeItemId={activeItemId}
          linkComponent={RouterLink}
          ariaLabel={t('nav.admin')}
          className={styles.sidebar}
        />
        <div className={styles.content}>
          <Outlet />
        </div>
      </Container>
    </AppLayout>
  );
}
