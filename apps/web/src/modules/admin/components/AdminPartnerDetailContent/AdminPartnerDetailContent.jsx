/**
 * AdminPartnerDetailContent — `/:locale/admin/partners/:id` (Partner
 * Management detail). Composes two independent reads (profile, recent
 * bookings) — each its own query/loading/error state, same reasoning
 * `AdminUserDetailContent` documents (a permission edge case on one
 * shouldn't block the other from rendering; a MODERATOR has
 * `partner.moderate` but not `booking.view_all`, so its bookings query
 * may legitimately fail while the profile still loads fine).
 *
 * Two independent action groups, matching the two independent status
 * columns this schema actually has (`partnerService.js`'s doc comment):
 * Verification (Approve/Reject, gated by `partner.verify`) and
 * Visibility/Moderation (Suspend/Restore, gated by `partner.moderate`).
 * Each group only renders for a role that actually holds its permission
 * (Phase 14.10 cleanup) — a role lacking both (e.g. SUPPORT) sees the
 * read-only profile with neither action group, rather than buttons that
 * always 403 on click.
 */

import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Section, Stack, Grid, Inline } from '@travelhub/ui/components/layout';
import { Card, Badge, Button } from '@travelhub/ui/components/primitives';
import {
  Skeleton,
  EmptyState,
  ErrorState,
} from '@travelhub/ui/components/feedback-overlays';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useAdminPartnerDetailQuery } from '../../queries/useAdminPartnerDetailQuery.js';
import { useAdminPartnerBookingsQuery } from '../../queries/useAdminPartnerBookingsQuery.js';
import { useUpdatePartnerVerificationStatusMutation } from '../../mutations/useUpdatePartnerVerificationStatusMutation.js';
import { useUpdatePartnerModerationStatusMutation } from '../../mutations/useUpdatePartnerModerationStatusMutation.js';

const VERIFICATION_BADGE_VARIANT = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const MODERATION_BADGE_VARIANT = {
  APPROVED: 'success',
  FLAGGED: 'danger',
};

export default function AdminPartnerDetailContent() {
  const { t, i18n } = useTranslation();
  const { locale, id } = useParams();
  const { permissions } = useAuth();
  const confirm = useConfirm();
  const { showToast } = useToast();
  const canVerify = permissions.includes('partner.verify');
  const canModerate = permissions.includes('partner.moderate');

  const partnerQuery = useAdminPartnerDetailQuery(id);
  const bookingsQuery = useAdminPartnerBookingsQuery(id);
  const verificationMutation = useUpdatePartnerVerificationStatusMutation();
  const moderationMutation = useUpdatePartnerModerationStatusMutation();

  if (partnerQuery.isError) {
    return (
      <Section spacing="default">
        <ErrorState
          title={t('admin.partnerDetail.error.title')}
          retryLabel={t('admin.partnerDetail.error.retry')}
          onRetry={partnerQuery.refetch}
        />
      </Section>
    );
  }

  const partner = partnerQuery.data;

  async function handleVerificationDecision(nextStatus) {
    const confirmed = await confirm({
      title: t(
        nextStatus === 'APPROVED'
          ? 'admin.partnerDetail.verification.approveConfirmTitle'
          : 'admin.partnerDetail.verification.rejectConfirmTitle',
        { name: partner.display_name },
      ),
      description: t(
        nextStatus === 'APPROVED'
          ? 'admin.partnerDetail.verification.approveConfirmDescription'
          : 'admin.partnerDetail.verification.rejectConfirmDescription',
      ),
      confirmLabel: t(
        nextStatus === 'APPROVED'
          ? 'admin.partnerDetail.verification.approveAction'
          : 'admin.partnerDetail.verification.rejectAction',
      ),
      cancelLabel: t('common.cancel'),
      variant: nextStatus === 'APPROVED' ? 'primary' : 'danger',
    });
    if (!confirmed) return;

    try {
      await verificationMutation.mutateAsync({
        id: partner.id,
        status: nextStatus,
      });
      showToast(
        t(
          nextStatus === 'APPROVED'
            ? 'admin.partnerDetail.verification.approveSuccess'
            : 'admin.partnerDetail.verification.rejectSuccess',
        ),
        { variant: 'success' },
      );
    } catch {
      showToast(t('admin.partners.statusError'), { variant: 'danger' });
    }
  }

  async function handleToggleModeration() {
    const nextStatus =
      partner.moderation_status === 'FLAGGED' ? 'APPROVED' : 'FLAGGED';
    const confirmed = await confirm({
      title: t(
        nextStatus === 'FLAGGED'
          ? 'admin.partners.suspendConfirmTitle'
          : 'admin.partners.restoreConfirmTitle',
        { name: partner.display_name },
      ),
      description: t(
        nextStatus === 'FLAGGED'
          ? 'admin.partners.suspendConfirmDescription'
          : 'admin.partners.restoreConfirmDescription',
      ),
      confirmLabel: t(
        nextStatus === 'FLAGGED'
          ? 'admin.partnerDetail.moderation.suspendAction'
          : 'admin.partnerDetail.moderation.restoreAction',
      ),
      cancelLabel: t('common.cancel'),
      variant: nextStatus === 'FLAGGED' ? 'danger' : 'primary',
    });
    if (!confirmed) return;

    try {
      await moderationMutation.mutateAsync({
        id: partner.id,
        status: nextStatus,
      });
      showToast(
        t(
          nextStatus === 'FLAGGED'
            ? 'admin.partners.suspendSuccess'
            : 'admin.partners.restoreSuccess',
        ),
        { variant: 'success' },
      );
    } catch {
      showToast(t('admin.partners.statusError'), { variant: 'danger' });
    }
  }

  const bookings = bookingsQuery.data ?? [];

  return (
    <Section spacing="default">
      <PageHeader
        title={
          partner ? partner.display_name : t('admin.partnerDetail.loading')
        }
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.partners.heading'),
            href: `/${locale}/admin/partners`,
          },
        ]}
      />

      <Stack gap="6">
        <Card as="div" padding="lg">
          {partnerQuery.isPending ? (
            <Skeleton variant="text" width="60%" />
          ) : (
            <Stack gap="4">
              <Inline justify="space-between" align="center" wrap>
                <Stack gap="1">
                  <strong>{partner.email ?? '—'}</strong>
                  <span>
                    {t('admin.partnerDetail.owner')}:{' '}
                    {partner.owner
                      ? `${partner.owner.first_name} ${partner.owner.last_name} (${partner.owner.email})`
                      : t('admin.partnerDetail.noOwner')}
                  </span>
                  <span>
                    {t('admin.partnerDetail.stats.totalListings')}:{' '}
                    {partner.total_listing_count} ·{' '}
                    {t('admin.partnerDetail.stats.publishedListings')}:{' '}
                    {partner.published_listing_count}
                  </span>
                </Stack>
                <Inline gap="3" align="center" wrap>
                  <Badge
                    variant={
                      VERIFICATION_BADGE_VARIANT[partner.verification_status] ??
                      'neutral'
                    }
                    label={t(
                      `admin.partners.verificationStatus.${partner.verification_status}`,
                      { defaultValue: partner.verification_status },
                    )}
                  />
                  <Badge
                    variant={
                      MODERATION_BADGE_VARIANT[partner.moderation_status] ??
                      'neutral'
                    }
                    label={t(
                      `admin.partners.moderationStatus.${partner.moderation_status}`,
                      { defaultValue: partner.moderation_status },
                    )}
                  />
                </Inline>
              </Inline>

              {(canVerify || canModerate) && (
                <Inline gap="3" wrap>
                  {canVerify && (
                    <Stack gap="2">
                      <span>
                        {t('admin.partnerDetail.verification.heading')}
                      </span>
                      <Inline gap="2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleVerificationDecision('APPROVED')}
                          loading={verificationMutation.isPending}
                        >
                          {t('admin.partnerDetail.verification.approveAction')}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleVerificationDecision('REJECTED')}
                          loading={verificationMutation.isPending}
                        >
                          {t('admin.partnerDetail.verification.rejectAction')}
                        </Button>
                      </Inline>
                    </Stack>
                  )}

                  {canModerate && (
                    <Stack gap="2">
                      <span>{t('admin.partnerDetail.moderation.heading')}</span>
                      <Button
                        variant={
                          partner.moderation_status === 'FLAGGED'
                            ? 'primary'
                            : 'destructive'
                        }
                        size="sm"
                        onClick={() => handleToggleModeration()}
                        loading={moderationMutation.isPending}
                      >
                        {t(
                          partner.moderation_status === 'FLAGGED'
                            ? 'admin.partnerDetail.moderation.restoreAction'
                            : 'admin.partnerDetail.moderation.suspendAction',
                        )}
                      </Button>
                    </Stack>
                  )}
                </Inline>
              )}
            </Stack>
          )}
        </Card>

        <Grid columns={2} gap="4">
          <Card as="div" padding="lg">
            <Stack gap="3">
              <h2>{t('admin.partnerDetail.bookings.heading')}</h2>
              {bookingsQuery.isPending && (
                <Skeleton variant="text" width="80%" />
              )}
              {!bookingsQuery.isPending && bookings.length === 0 && (
                <EmptyState title={t('admin.partnerDetail.bookings.empty')} />
              )}
              {!bookingsQuery.isPending && bookings.length > 0 && (
                <Stack gap="2">
                  {bookings.map((booking) => (
                    <Inline
                      key={booking.id}
                      justify="space-between"
                      align="center"
                    >
                      <RouterLink
                        href={`/${locale}/admin/bookings/${booking.id}`}
                      >
                        {booking.booking_reference}
                      </RouterLink>
                      <Badge
                        variant="neutral"
                        size="sm"
                        label={t(`bookings.status.${booking.status}`, {
                          defaultValue: booking.status,
                        })}
                      />
                      <span>
                        {new Intl.NumberFormat(i18n.language).format(
                          booking.total_amount,
                        )}
                      </span>
                    </Inline>
                  ))}
                </Stack>
              )}
            </Stack>
          </Card>
        </Grid>
      </Stack>
    </Section>
  );
}
