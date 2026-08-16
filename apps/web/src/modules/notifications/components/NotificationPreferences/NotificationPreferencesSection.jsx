/**
 * NotificationPreferencesSection — per-category in-app/email toggle
 * list. Reuses `Switch` (Phase 11's Settings module primitive) rather
 * than inventing a new toggle control.
 */

import { useTranslation } from 'react-i18next';
import {
  Skeleton,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import { Switch } from '@travelhub/ui/components/form-controls';
import { Stack } from '@travelhub/ui/components/layout';
import { useNotificationPreferencesQuery } from '../../queries/useNotificationPreferencesQuery.js';
import { useUpdateNotificationPreferenceMutation } from '../../mutations/useUpdateNotificationPreferenceMutation.js';
import styles from './NotificationPreferencesSection.module.scss';

export default function NotificationPreferencesSection() {
  const { t } = useTranslation();
  const {
    data: preferences,
    isPending,
    isError,
    refetch,
  } = useNotificationPreferencesQuery();
  const updateMutation = useUpdateNotificationPreferenceMutation();

  return (
    <div>
      <h2 className={styles.heading}>
        {t('notifications.preferences.heading')}
      </h2>
      <p className={styles.description}>
        {t('notifications.preferences.description')}
      </p>

      {isError && (
        <ErrorState
          title={t('notifications.preferences.errorTitle')}
          retryLabel={t('notifications.preferences.errorRetry')}
          onRetry={() => refetch()}
        />
      )}
      {!isError && isPending && (
        <Stack gap="2">
          {Array.from({ length: 6 }, (_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- fixed skeleton count, no real data yet
            <Skeleton key={index} variant="rect" height={48} />
          ))}
        </Stack>
      )}
      {!isError && !isPending && (
        <Stack gap="3">
          {preferences.map((preference) => (
            <div key={preference.category} className={styles.row}>
              <p className={styles.categoryName}>
                {t(`notifications.categories.${preference.category}`)}
              </p>
              <div className={styles.switches}>
                <Switch
                  checked={preference.in_app_enabled}
                  label={t('notifications.preferences.inApp')}
                  onChange={(event) =>
                    updateMutation.mutate({
                      category: preference.category,
                      inAppEnabled: event.target.checked,
                      emailEnabled: preference.email_enabled,
                    })
                  }
                />
                <Switch
                  checked={preference.email_enabled}
                  label={t('notifications.preferences.email')}
                  onChange={(event) =>
                    updateMutation.mutate({
                      category: preference.category,
                      inAppEnabled: preference.in_app_enabled,
                      emailEnabled: event.target.checked,
                    })
                  }
                />
              </div>
            </div>
          ))}
        </Stack>
      )}
    </div>
  );
}
