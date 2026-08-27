/**
 * AdminBookingDetailContent — `/:locale/admin/bookings/:id` (Stage 11.4:
 * Booking Operations). Composes the booking itself
 * (`useAdminBookingDetailQuery`) and its real status-history timeline
 * (`useAdminBookingHistoryQuery`, the first read path onto the
 * previously write-only `booking_status_history` table) — two
 * independent reads, same "one failure shouldn't block the other"
 * reasoning `AdminUserDetailContent`/`AdminPartnerDetailContent` already
 * document, though in practice both come from the exact same permission
 * check (`booking.view_all`) so they succeed/fail together.
 *
 * Action set follows `bookingStatusTransitions.js`'s state machine
 * exactly, never a raw status overwrite: `PENDING_VENDOR` offers
 * Confirm/Reject, `CONFIRMED` offers Cancel/Complete/Mark no-show, every
 * other status (including every terminal one) offers nothing. Reject
 * doesn't collect a reason through a new form — same `ConfirmContext`
 * plain yes/no limitation `PartnerBookingDetailContent`'s own Reject
 * flow already accepts.
 *
 * There is no admin listing detail page yet, so the listing this booking
 * is for is shown as plain text, not a dead link.
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import {
  Spinner,
  ErrorState,
  EmptyState,
} from '@desavii/ui/components/feedback-overlays';
import { Button, Card } from '@desavii/ui/components/primitives';
import { PriceTag } from '@desavii/ui/components/data-display';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useAdminBookingDetailQuery } from '../../queries/useAdminBookingDetailQuery.js';
import { useAdminBookingHistoryQuery } from '../../queries/useAdminBookingHistoryQuery.js';
import { useAdminConfirmBookingMutation } from '../../mutations/useAdminConfirmBookingMutation.js';
import { useAdminRejectBookingMutation } from '../../mutations/useAdminRejectBookingMutation.js';
import { useAdminCancelBookingMutation } from '../../mutations/useAdminCancelBookingMutation.js';
import { useAdminCompleteBookingMutation } from '../../mutations/useAdminCompleteBookingMutation.js';
import { useAdminMarkNoShowMutation } from '../../mutations/useAdminMarkNoShowMutation.js';
import { BookingStatusBadge } from '../../../bookings/index.js';
import { BookingPaymentSection } from '../../../payments/index.js';
import { computeNights } from '../../../bookings/utils/computeNights.js';

export default function AdminBookingDetailContent() {
  const { t, i18n } = useTranslation();
  const { locale, id } = useParams();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const bookingId = Number(id);
  const canConfirm = permissions.includes('booking.confirm');
  const canReject = permissions.includes('booking.reject');
  const canCancelAny = permissions.includes('booking.cancel_any');

  const {
    data: booking,
    isPending,
    isError,
    error,
    refetch,
  } = useAdminBookingDetailQuery(bookingId);
  const historyQuery = useAdminBookingHistoryQuery(bookingId);

  const confirmMutation = useAdminConfirmBookingMutation();
  const rejectMutation = useAdminRejectBookingMutation();
  const cancelMutation = useAdminCancelBookingMutation();
  const completeMutation = useAdminCompleteBookingMutation();
  const noShowMutation = useAdminMarkNoShowMutation();

  if (isPending) {
    return (
      <Section aria-label={t('admin.bookingDetail.loading')}>
        <Spinner label={t('admin.bookingDetail.loading')} />
      </Section>
    );
  }

  if (isError) {
    if (error.status === 404) {
      return (
        <EmptyState
          title={t('errors.notFound.title')}
          description={t('errors.notFound.description')}
          actionLabel={t('errors.notFound.action')}
          onAction={() => navigate(`/${locale}/admin/bookings`)}
        />
      );
    }
    return (
      <Section>
        <ErrorState
          title={t('admin.bookingDetail.error.title')}
          retryLabel={t('admin.bookingDetail.error.retry')}
          onRetry={refetch}
        />
      </Section>
    );
  }

  const heading = t('admin.bookingDetail.heading', {
    reference: booking.booking_reference,
  });
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
  });
  const dateTimeFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const canConfirmOrReject = booking.status === 'PENDING_VENDOR';
  const canActOnConfirmed = booking.status === 'CONFIRMED';
  const showConfirm = canConfirmOrReject && canConfirm;
  const showReject = canConfirmOrReject && canReject;
  const showComplete = canActOnConfirmed && canConfirm;
  const showNoShow = canActOnConfirmed && canConfirm;
  const showCancel = canActOnConfirmed && canCancelAny;
  const history = historyQuery.data ?? [];

  async function handleConfirm() {
    try {
      await confirmMutation.mutateAsync({ id: bookingId });
      showToast(t('admin.bookingDetail.confirmSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.bookingDetail.actionError'), { variant: 'danger' });
    }
  }

  async function handleReject() {
    const confirmed = await confirm({
      title: t('admin.bookingDetail.rejectConfirmTitle'),
      description: t('admin.bookingDetail.rejectConfirmDescription'),
      confirmLabel: t('admin.bookingDetail.rejectAction'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await rejectMutation.mutateAsync({ id: bookingId });
      showToast(t('admin.bookingDetail.rejectSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.bookingDetail.actionError'), { variant: 'danger' });
    }
  }

  async function handleCancel() {
    const confirmed = await confirm({
      title: t('admin.bookingDetail.cancelConfirmTitle'),
      description: t('admin.bookingDetail.cancelConfirmDescription'),
      confirmLabel: t('admin.bookingDetail.cancelAction'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await cancelMutation.mutateAsync({ id: bookingId });
      showToast(t('admin.bookingDetail.cancelSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.bookingDetail.actionError'), { variant: 'danger' });
    }
  }

  async function handleComplete() {
    const confirmed = await confirm({
      title: t('admin.bookingDetail.completeConfirmTitle'),
      description: t('admin.bookingDetail.completeConfirmDescription'),
      confirmLabel: t('admin.bookingDetail.completeAction'),
      cancelLabel: t('common.cancel'),
      variant: 'primary',
    });
    if (!confirmed) return;
    try {
      await completeMutation.mutateAsync({ id: bookingId });
      showToast(t('admin.bookingDetail.completeSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.bookingDetail.actionError'), { variant: 'danger' });
    }
  }

  async function handleNoShow() {
    const confirmed = await confirm({
      title: t('admin.bookingDetail.noShowConfirmTitle'),
      description: t('admin.bookingDetail.noShowConfirmDescription'),
      confirmLabel: t('admin.bookingDetail.noShowAction'),
      cancelLabel: t('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await noShowMutation.mutateAsync({ id: bookingId });
      showToast(t('admin.bookingDetail.noShowSuccess'), {
        variant: 'success',
      });
    } catch {
      showToast(t('admin.bookingDetail.actionError'), { variant: 'danger' });
    }
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={heading}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          { label: t('admin.nav.dashboard'), href: `/${locale}/admin` },
          {
            label: t('admin.bookings.heading'),
            href: `/${locale}/admin/bookings`,
          },
          {
            label: heading,
            href: `/${locale}/admin/bookings/${booking.id}`,
          },
        ]}
      />
      <Stack gap="4">
        <Card as="div" padding="lg">
          <Stack gap="4">
            <Inline gap="3" align="center">
              <BookingStatusBadge status={booking.status} />
              <PriceTag
                amount={booking.total_amount}
                currencyCode={booking.currency}
                suffix={t('bookings.detail.total')}
              />
            </Inline>

            <Stack gap="1">
              <p>
                {t('admin.bookingDetail.customer')}:{' '}
                <RouterLink
                  href={`/${locale}/admin/users/${booking.customer_user_id}`}
                >
                  {t('admin.bookings.table.customerLink', {
                    id: booking.customer_user_id,
                  })}
                </RouterLink>
              </p>
              <p>
                {t('admin.bookingDetail.partner')}:{' '}
                <RouterLink
                  href={`/${locale}/admin/partners/${booking.partner_id}`}
                >
                  {t('admin.bookings.table.partnerLink', {
                    id: booking.partner_id,
                  })}
                </RouterLink>
              </p>
              <p>
                {t('admin.bookingDetail.listing')}:{' '}
                {t('admin.bookingDetail.listingId', {
                  id: booking.listing_id,
                })}
              </p>
              {booking.refund_status && (
                <p>
                  {t('admin.bookingDetail.refundStatus')}:{' '}
                  {t(
                    `admin.bookingDetail.refundStatusValue.${booking.refund_status}`,
                    {
                      defaultValue: booking.refund_status,
                    },
                  )}
                </p>
              )}
            </Stack>

            <Stack gap="3">
              {booking.items.map((item) => {
                const nights = computeNights(item);
                return (
                  <div key={item.id}>
                    {item.unit_label && (
                      <p>
                        {t('bookings.detail.roomType')}: {item.unit_label}
                      </p>
                    )}
                    <p>
                      {t('bookings.detail.dates')}:{' '}
                      {dateFormatter.format(new Date(item.date_from))} –{' '}
                      {dateFormatter.format(new Date(item.date_to))}
                    </p>
                    {nights !== null && (
                      <p>
                        {t('bookings.detail.nights')}: {nights}
                      </p>
                    )}
                    <p>
                      {t('bookings.detail.quantity')}: {item.quantity}
                    </p>
                    {item.guests.length > 0 && (
                      <p>
                        {t('bookings.detail.guests')}: {item.guests.length}
                      </p>
                    )}
                  </div>
                );
              })}
            </Stack>

            <Stack gap="1">
              <p>
                {t('bookings.detail.contactName')}:{' '}
                {booking.guest_contact_snapshot.fullName}
              </p>
              <p>
                {t('bookings.detail.contactEmail')}:{' '}
                {booking.guest_contact_snapshot.email}
              </p>
              {booking.guest_contact_snapshot.phone && (
                <p>
                  {t('bookings.detail.contactPhone')}:{' '}
                  {booking.guest_contact_snapshot.phone}
                </p>
              )}
            </Stack>

            {booking.cancellation_reason && (
              <p>
                {t('bookings.detail.cancellationReason')}:{' '}
                {booking.cancellation_reason}
              </p>
            )}
          </Stack>
        </Card>

        <BookingPaymentSection booking={booking} readOnly />

        {booking.customer_notes && (
          <Card as="div" padding="lg">
            <Stack gap="1">
              <h2>{t('admin.bookingDetail.notes')}</h2>
              <p>{booking.customer_notes}</p>
            </Stack>
          </Card>
        )}

        <Card as="div" padding="lg">
          <Stack gap="2">
            <h2>{t('admin.bookingDetail.history.heading')}</h2>
            {historyQuery.isPending && (
              <span>{t('admin.bookingDetail.history.loading')}</span>
            )}
            {!historyQuery.isPending && history.length === 0 && (
              <EmptyState title={t('admin.bookingDetail.history.empty')} />
            )}
            {!historyQuery.isPending && history.length > 0 && (
              <Stack gap="1">
                {history.map((entry) => (
                  <p key={entry.id}>
                    {entry.from_status
                      ? t(`bookings.status.${entry.from_status}`, {
                          defaultValue: entry.from_status,
                        })
                      : t('admin.bookingDetail.history.created')}{' '}
                    →{' '}
                    {t(`bookings.status.${entry.to_status}`, {
                      defaultValue: entry.to_status,
                    })}{' '}
                    — {dateTimeFormatter.format(new Date(entry.changed_at))}
                  </p>
                ))}
              </Stack>
            )}
          </Stack>
        </Card>

        {(showConfirm ||
          showReject ||
          showComplete ||
          showNoShow ||
          showCancel) && (
          <Inline gap="3" wrap>
            {showConfirm && (
              <Button
                variant="primary"
                onClick={() => handleConfirm()}
                loading={confirmMutation.isPending}
              >
                {t('admin.bookingDetail.confirmAction')}
              </Button>
            )}
            {showReject && (
              <Button
                variant="destructive"
                onClick={() => handleReject()}
                loading={rejectMutation.isPending}
              >
                {t('admin.bookingDetail.rejectAction')}
              </Button>
            )}
            {showComplete && (
              <Button
                variant="primary"
                onClick={() => handleComplete()}
                loading={completeMutation.isPending}
              >
                {t('admin.bookingDetail.completeAction')}
              </Button>
            )}
            {showNoShow && (
              <Button
                variant="destructive"
                onClick={() => handleNoShow()}
                loading={noShowMutation.isPending}
              >
                {t('admin.bookingDetail.noShowAction')}
              </Button>
            )}
            {showCancel && (
              <Button
                variant="destructive"
                onClick={() => handleCancel()}
                loading={cancelMutation.isPending}
              >
                {t('admin.bookingDetail.cancelAction')}
              </Button>
            )}
          </Inline>
        )}
      </Stack>
    </Section>
  );
}
