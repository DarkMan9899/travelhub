/**
 * SettingsPageContent — `/:locale/account/settings`. Security (change
 * password, real), notification preferences (Phase 13's
 * `notification_preferences` table is real backing — reuses
 * `NotificationPreferencesSection` rather than duplicating its
 * query/mutation logic here), and a Danger Zone (account deletion,
 * honestly not available yet).
 *
 * Each section sits in its own shared `Card` panel (Phase 10 redesign),
 * matching the panel treatment `DashboardOverviewContent`/
 * `BookingDetailPageContent` already use.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack } from '@desavii/ui/components/layout';
import { Card } from '@desavii/ui/components/primitives';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { NotificationPreferencesSection } from '../../../notifications/index.js';
import { useChangePasswordMutation } from '../../mutations/useChangePasswordMutation.js';
import ChangePasswordForm from '../ChangePasswordForm/ChangePasswordForm.jsx';
import DangerZone from '../DangerZone/DangerZone.jsx';

export default function SettingsPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const { user } = useAuth();
  const { showToast } = useToast();
  const changePasswordMutation = useChangePasswordMutation(user.id);

  async function handleChangePassword(values) {
    try {
      await changePasswordMutation.mutateAsync(values);
      showToast(t('profile.settings.password.success'), {
        variant: 'success',
      });
      return true;
    } catch {
      return false;
    }
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={t('pages.settings.title')}
        breadcrumbs={[
          { label: t('nav.account'), href: `/${locale}/account` },
          {
            label: t('pages.settings.title'),
            href: `/${locale}/account/settings`,
          },
        ]}
      />
      <Stack gap="6">
        <Card as="div" padding="lg">
          <Stack gap="2">
            <h2>{t('profile.settings.password.heading')}</h2>
            <ChangePasswordForm
              isPending={changePasswordMutation.isPending}
              error={changePasswordMutation.error}
              onSave={(values) => handleChangePassword(values)}
            />
          </Stack>
        </Card>
        <Card as="div" padding="lg">
          <NotificationPreferencesSection />
        </Card>
        <Card as="div" padding="lg">
          <DangerZone />
        </Card>
      </Stack>
    </Section>
  );
}
