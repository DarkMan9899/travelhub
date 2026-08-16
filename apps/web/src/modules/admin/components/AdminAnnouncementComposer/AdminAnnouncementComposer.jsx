/**
 * AdminAnnouncementComposer — Phase 14.10 cleanup. `POST
 * /notifications/announcements` (broadcast a notification to every user,
 * or every user holding a given role) and the frontend's rendering of the
 * resulting `admin.announcement` notifications (`notificationCopy.js`)
 * were both already real — this was the one missing piece, a compose
 * form. Rendered only on the Admin Notifications page
 * (`AdminNotificationsPage.jsx`), above the shared `NotificationsPageContent`
 * every role/layout otherwise reuses verbatim, since broadcasting is an
 * admin-only capability, not part of that shared component.
 *
 * The backend checks `principal.roles` directly for this one action
 * (`ADMIN`/`SUPER_ADMIN` only — see `notificationService.createAnnouncement`),
 * not a permission key like every other admin write, so this reads
 * `roles` from `useAuth()` rather than `permissions`.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button } from '@travelhub/ui/components/primitives';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import {
  Input,
  Textarea,
  Select,
  Checkbox,
} from '@travelhub/ui/components/form-controls';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useCreateAnnouncementMutation } from '../../mutations/useCreateAnnouncementMutation.js';

const ROLE_OPTIONS = [
  'CUSTOMER',
  'MODERATOR',
  'ADMIN',
  'SUPER_ADMIN',
  'SUPPORT',
];
const PRIORITY_OPTIONS = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const EMPTY_FORM = {
  audienceType: 'ALL',
  roles: [],
  priorityCode: 'NORMAL',
  title: '',
  body: '',
};

export default function AdminAnnouncementComposer() {
  const { t } = useTranslation();
  const { roles } = useAuth();
  const { showToast } = useToast();
  const mutation = useCreateAnnouncementMutation();
  const [values, setValues] = useState(EMPTY_FORM);

  // Same "render nothing rather than a button that always 403s" rule as
  // every other permission-gated admin action — this one just checks a
  // role directly, matching the backend's own check.
  const canBroadcast = roles.some((role) =>
    ['ADMIN', 'SUPER_ADMIN'].includes(role),
  );
  if (!canBroadcast) return null;

  function setField(name, value) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function toggleRole(role) {
    setValues((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((existing) => existing !== role)
        : [...prev.roles, role],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const audience =
      values.audienceType === 'ALL'
        ? { type: 'ALL' }
        : { type: 'ROLE', roles: values.roles };
    try {
      await mutation.mutateAsync({
        audience,
        priorityCode: values.priorityCode,
        payload: {
          title: values.title.trim(),
          body: values.body.trim() || undefined,
        },
      });
      showToast(t('admin.notifications.announcement.success'), {
        variant: 'success',
      });
      setValues(EMPTY_FORM);
    } catch {
      showToast(t('admin.notifications.announcement.error'), {
        variant: 'danger',
      });
    }
  }

  const audienceOptions = [
    { value: 'ALL', label: t('admin.notifications.announcement.audienceAll') },
    {
      value: 'ROLE',
      label: t('admin.notifications.announcement.audienceRoles'),
    },
  ];
  const priorityOptions = PRIORITY_OPTIONS.map((code) => ({
    value: code,
    label: t(`admin.notifications.announcement.priority.${code}`),
  }));

  const canSubmit =
    values.title.trim().length > 0 &&
    (values.audienceType === 'ALL' || values.roles.length > 0);

  return (
    <Card as="div" padding="lg">
      <form onSubmit={handleSubmit}>
        <Stack gap="3">
          <h2>{t('admin.notifications.announcement.heading')}</h2>
          <p>{t('admin.notifications.announcement.description')}</p>

          <Select
            label={t('admin.notifications.announcement.audienceLabel')}
            options={audienceOptions}
            value={values.audienceType}
            onChange={(value) => setField('audienceType', value)}
          />

          {values.audienceType === 'ROLE' && (
            <Stack gap="2">
              {ROLE_OPTIONS.map((role) => (
                <Checkbox
                  key={role}
                  label={t(`admin.notifications.announcement.roles.${role}`)}
                  checked={values.roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
              ))}
            </Stack>
          )}

          <Select
            label={t('admin.notifications.announcement.priorityLabel')}
            options={priorityOptions}
            value={values.priorityCode}
            onChange={(value) => setField('priorityCode', value)}
          />

          <Input
            label={t('admin.notifications.announcement.titleLabel')}
            value={values.title}
            onChange={(event) => setField('title', event.target.value)}
            required
            maxLength={255}
          />

          <Textarea
            label={t('admin.notifications.announcement.bodyLabel')}
            value={values.body}
            onChange={(event) => setField('body', event.target.value)}
            rows={4}
            maxLength={4000}
          />

          <Inline justify="flex-end">
            <Button
              type="submit"
              variant="primary"
              loading={mutation.isPending}
              disabled={!canSubmit}
            >
              {t('admin.notifications.announcement.submitAction')}
            </Button>
          </Inline>
        </Stack>
      </form>
    </Card>
  );
}
