/**
 * DangerZone — informational only, deliberately not an interactive
 * control. No self-service account deletion endpoint exists anywhere in
 * the backend (`users`/`auth` modules were audited for Phase 8 — the
 * `users.deleted_at`/`status_id` columns exist but no route uses them for
 * this) — offering a button that can't actually do anything would be
 * worse than being upfront about the gap, matching the same "honest
 * state, not a dead action" precedent as `ListingReservationWidget`'s
 * "not bookable yet" message.
 *
 * Renders just its content `Stack` — the caller (`SettingsPageContent`)
 * wraps it in a `Card` panel (Phase 10 redesign), so this component no
 * longer owns its own `Section` wrapper.
 */

import { useTranslation } from 'react-i18next';
import { Stack } from '@desavii/ui/components/layout';
import { Alert } from '@desavii/ui/components/feedback-overlays';

export default function DangerZone() {
  const { t } = useTranslation();

  return (
    <Stack gap="2">
      <h2>{t('profile.settings.dangerZone.heading')}</h2>
      <Alert variant="warning">
        {t('profile.settings.dangerZone.deleteAccountUnavailable')}
      </Alert>
    </Stack>
  );
}
