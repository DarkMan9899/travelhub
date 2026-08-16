/**
 * AdminNotificationsPageContent — composes the announcement composer with
 * the shared `NotificationsPageContent` (role-agnostic, `notifications`
 * module's own export) for the Admin notifications page. Lives here
 * rather than being composed directly in `pages/admin/AdminNotificationsPage.jsx`
 * so the page stays a thin one-line wrapper, matching every other admin
 * page's convention.
 */

import { Stack } from '@travelhub/ui/components/layout';
import { NotificationsPageContent } from '../../../notifications/index.js';
import AdminAnnouncementComposer from '../AdminAnnouncementComposer/AdminAnnouncementComposer.jsx';

export default function AdminNotificationsPageContent() {
  return (
    <Stack gap="4">
      <AdminAnnouncementComposer />
      <NotificationsPageContent />
    </Stack>
  );
}
