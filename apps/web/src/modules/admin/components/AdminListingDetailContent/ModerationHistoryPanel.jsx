/**
 * ModerationHistoryPanel — real moderation history for one listing,
 * sourced from the generic `audit_logs` table (there is no dedicated
 * `listing_moderation_history` table — `listings.moderation_notes` is
 * overwritten in place on every status change, so the audit log's
 * `before_snapshot`/`after_snapshot` on the `listing.moderation_status_
 * changed` action is the only real record of what changed and when;
 * see `listingService.js#updateModerationStatus`).
 *
 * Only rendered by the caller when the signed-in admin already holds
 * `audit.view` (granted to SUPER_ADMIN/ADMIN/SUPPORT, not MODERATOR) —
 * this panel does not request or depend on any new permission grant.
 * `MODERATOR` (the role that actually holds `listing.moderate`) simply
 * never sees this panel, exactly matching its current, unchanged
 * authorization — nothing here alters who can do what.
 */

import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Button } from '@desavii/ui/components/primitives';
import { Stack, Inline } from '@desavii/ui/components/layout';
import { Skeleton, EmptyState } from '@desavii/ui/components/feedback-overlays';
import { useAdminAuditLogsQuery } from '../../queries/useAdminAuditLogsQuery.js';

const MODERATION_BADGE_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FLAGGED: 'danger',
};

export default function ModerationHistoryPanel({ listingId }) {
  const { t, i18n } = useTranslation();
  const { data, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAdminAuditLogsQuery({
      targetType: 'listing',
      targetId: listingId,
      action: 'listing.moderation_status_changed',
    });

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  );

  const entries = useMemo(
    () => data?.pages.flatMap((page) => page.results) ?? [],
    [data],
  );

  if (isPending) return <Skeleton variant="text" width="70%" />;

  if (entries.length === 0) {
    return <EmptyState title={t('admin.listingDetail.history.empty')} />;
  }

  return (
    <Stack gap="3">
      <h3>{t('admin.listingDetail.history.heading')}</h3>
      {entries.map((entry) => {
        const fromCode = entry.before_snapshot?.moderationStatusCode;
        const toCode = entry.after_snapshot?.moderationStatusCode;
        const notes = entry.after_snapshot?.notes;
        return (
          <Card key={entry.id} padding="md">
            <Stack gap="1">
              <Inline justify="space-between" wrap align="center">
                <span>{dateFormatter.format(new Date(entry.created_at))}</span>
                <span>
                  {entry.actor_name || t('admin.auditLogs.systemActor')}
                </span>
              </Inline>
              <Inline gap="2" align="center" wrap>
                {fromCode && (
                  <Badge
                    variant={MODERATION_BADGE_VARIANT[fromCode] ?? 'neutral'}
                    size="sm"
                    label={t(
                      `admin.listingModeration.moderationStatus.${fromCode}`,
                      { defaultValue: fromCode },
                    )}
                  />
                )}
                <span aria-hidden="true">→</span>
                {toCode && (
                  <Badge
                    variant={MODERATION_BADGE_VARIANT[toCode] ?? 'neutral'}
                    size="sm"
                    label={t(
                      `admin.listingModeration.moderationStatus.${toCode}`,
                      { defaultValue: toCode },
                    )}
                  />
                )}
              </Inline>
              {notes && (
                <span>
                  {t('admin.listingDetail.history.notesPrefix')} {notes}
                </span>
              )}
            </Stack>
          </Card>
        );
      })}
      {hasNextPage && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
        >
          {t('admin.listingModeration.loadMore')}
        </Button>
      )}
    </Stack>
  );
}

ModerationHistoryPanel.propTypes = {
  listingId: PropTypes.number.isRequired,
};
