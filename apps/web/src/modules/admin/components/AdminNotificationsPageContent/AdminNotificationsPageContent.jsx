/**
 * AdminNotificationsPageContent — composes the announcement composer with
 * the shared `NotificationsPageContent` (role-agnostic, `notifications`
 * module's own export) for the Admin notifications page. Lives here
 * rather than being composed directly in `pages/admin/AdminNotificationsPage.jsx`
 * so the page stays a thin one-line wrapper, matching every other admin
 * page's convention.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Stack } from '@desavii/ui/components/layout';
import { NotificationsPageContent } from '../../../notifications/index.js';
import AdminAnnouncementComposer from '../AdminAnnouncementComposer/AdminAnnouncementComposer.jsx';

export default function AdminNotificationsPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();

  return (
    <Stack gap="4">
      <AdminAnnouncementComposer />
      <NotificationsPageContent
        audience="admin"
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('notifications.page.heading'),
            href: `/${locale}/admin/notifications`,
          },
        ]}
      />
    </Stack>
  );
}
