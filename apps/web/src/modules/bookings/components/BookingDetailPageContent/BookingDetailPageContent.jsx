/**
 * BookingDetailPageContent — `/:locale/account/bookings/:id`. Full detail
 * for one booking (items/guest-contact-snapshot/notes/total), with a
 * status-gated Cancel action. Cancellable states mirror
 * `bookingStatusTransitions.js`'s domain rule exactly: only `PENDING_VENDOR`
 * and `CONFIRMED` can transition to a cancelled state; every other status
 * is terminal (`REJECTED`, `CANCELLED_BY_*`, `COMPLETED`, `NO_SHOW`,
 * `EXPIRED`) and the action is hidden rather than shown-then-rejected.
 *
 * 404 vs. retryable-error split, and `useDocumentMeta`-free page-title
 * approach, mirror `ListingDetailPageContent.jsx`'s own established
 * pattern from Phase 6.
 *
 * Booking summary/items/contact and the notes section each sit in their
 * own shared `Card` panel (Phase 10 redesign) — this page previously
 * rendered them as bare, unstyled `Stack`s.
 */

import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import {
  Skeleton,
  ErrorState,
  EmptyState,
} from '@desavii/ui/components/feedback-overlays';
import { Button, Card } from '@desavii/ui/components/primitives';
import { PriceTag } from '@desavii/ui/components/data-display';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import RouterLink from '../../../../components/RouterLink.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import { useConfirm } from '../../../../contexts/ConfirmContext.jsx';
import { useBookingQuery } from '../../queries/useBookingQuery.js';
import { useCancelBookingMutation } from '../../mutations/useCancelBookingMutation.js';
import BookingStatusBadge from '../BookingStatusBadge/BookingStatusBadge.jsx';
import {
  ReviewForm,
  useReviewForBookingQuery,
} from '../../../reviews/index.js';
import { useCreateConversationMutation } from '../../../messaging/index.js';
import { AskAiButton } from '../../../ai/index.js';
import { BookingPaymentSection } from '../../../payments/index.js';
import { useListingQuery } from '../../../listings/queries/useListingQuery.js';
import getLocalizedTranslation from '../../../listings/utils/getLocalizedTranslation.js';
import { computeNights } from '../../utils/computeNights.js';

// Mirrors `bookingStatusTransitions.js`'s domain rule exactly:
// `PENDING_VENDOR` may only become CONFIRMED/REJECTED/EXPIRED — never a
// cancelled state — so a still-pending request has no customer-initiated
// withdrawal path today; only a CONFIRMED booking can transition to
// CANCELLED_BY_CUSTOMER. Showing Cancel here for PENDING_VENDOR and
// letting the server reject it would be a worse experience than simply
// not offering an action that can never succeed.
const CANCELLABLE_STATUSES = ['CONFIRMED'];

export default function BookingDetailPageContent() {
  const { t, i18n } = useTranslation();
  const { locale, id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const bookingId = Number(id);

  const {
    data: booking,
    isPending,
    isError,
    error,
    refetch,
  } = useBookingQuery(bookingId);
  const cancelMutation = useCancelBookingMutation(bookingId);
  // Called unconditionally (Rules of Hooks) even before `booking` itself
  // has loaded — cheap, and only ever rendered once the booking is known
  // to be COMPLETED, below.
  const reviewQuery = useReviewForBookingQuery(bookingId);
  const createConversationMutation = useCreateConversationMutation();
  // P2.2E: same "follow up with the listing module's own query" tradeoff
  // `BookingCard.jsx` already documents — `enabled: Boolean(id)` makes
  // this a no-op until `booking` itself has loaded.
  const { data: listing } = useListingQuery(booking?.listing_id);

  if (isPending) {
    return (
      <Section
        spacing="default"
        aria-busy="true"
        aria-label={t('bookings.detail.loading')}
      >
        <Skeleton variant="text" width="40%" height={32} />
        <Stack gap="4">
          <Card as="div" padding="lg">
            <Stack gap="4">
              <Inline gap="3" align="center">
                <Skeleton variant="rect" width={100} height={28} />
                <Skeleton variant="text" width={120} />
              </Inline>
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="50%" />
            </Stack>
          </Card>
        </Stack>
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
          onAction={() => navigate(`/${locale}/account/bookings`)}
        />
      );
    }
    return (
      <Section>
        <ErrorState
          title={t('bookings.detail.error.title')}
          retryLabel={t('bookings.detail.error.retry')}
          onRetry={refetch}
        />
      </Section>
    );
  }

  const heading = t('bookings.detail.heading', {
    reference: booking.booking_reference,
  });
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
  });
  const canCancel = CANCELLABLE_STATUSES.includes(booking.status);
  const listingTitle = listing
    ? (getLocalizedTranslation(listing.translations, locale)?.title ??
      listing.slug)
    : null;

  async function handleCancel() {
    const confirmed = await confirm({
      title: t('bookings.detail.cancelConfirmTitle'),
      description: t('bookings.detail.cancelConfirmDescription'),
      confirmLabel: t('bookings.detail.cancelConfirmAction'),
      cancelLabel: t('bookings.detail.cancelConfirmDismiss'),
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await cancelMutation.mutateAsync();
      showToast(t('bookings.detail.cancelSuccess'), { variant: 'success' });
    } catch {
      showToast(t('bookings.detail.cancelError'), { variant: 'danger' });
    }
  }

  // Reuses the same context-scoped conversation every time (the backend
  // makes `POST /messaging/conversations` idempotent per
  // (contextType, contextId, principal) — see `conversationService.js`),
  // so clicking this more than once always reopens the SAME thread
  // instead of spawning duplicates.
  async function handleMessagePartner() {
    try {
      const result = await createConversationMutation.mutateAsync({
        participantUserIds: [booking.partner_owner_user_id],
        contextType: 'booking',
        contextId: booking.id,
      });
      navigate(`/${locale}/account/messages/${result.data.id}`);
    } catch {
      showToast(t('bookings.detail.messagePartnerError'), {
        variant: 'danger',
      });
    }
  }

  return (
    <Section spacing="default">
      <PageHeader
        title={heading}
        breadcrumbs={[
          { label: t('nav.home'), href: `/${locale}` },
          {
            label: t('bookings.list.heading'),
            href: `/${locale}/account/bookings`,
          },
          {
            label: heading,
            href: `/${locale}/account/bookings/${booking.id}`,
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

            {listingTitle && (
              <p>
                <RouterLink href={`/${locale}/listings/${listing.slug}`}>
                  {listingTitle}
                </RouterLink>
              </p>
            )}

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

        <BookingPaymentSection booking={booking} />

        {booking.customer_notes && (
          <Card as="div" padding="lg">
            <Stack gap="1">
              <h2>{t('bookings.detail.notes')}</h2>
              <p>{booking.customer_notes}</p>
            </Stack>
          </Card>
        )}

        <Inline gap="3">
          <AskAiButton
            label={t('ai.contextButtons.askAboutBooking')}
            contextType="booking"
            contextId={booking.id}
            initialMessage={t('ai.contextButtons.bookingInitialMessage')}
            variant="ghost"
            size="sm"
          />
        </Inline>

        {(canCancel || booking.partner_owner_user_id) && (
          <Inline gap="3">
            {booking.partner_owner_user_id && (
              <Button
                variant="secondary"
                onClick={() => handleMessagePartner()}
                loading={createConversationMutation.isPending}
              >
                {t('bookings.detail.messagePartnerAction')}
              </Button>
            )}
            {canCancel && (
              <Button
                variant="destructive"
                onClick={() => handleCancel()}
                loading={cancelMutation.isPending}
              >
                {t('bookings.detail.cancelAction')}
              </Button>
            )}
          </Inline>
        )}

        {booking.status === 'COMPLETED' && !reviewQuery.isPending && (
          <Card as="div" padding="lg">
            <Stack gap="3">
              <h2>{t('bookings.detail.review.heading')}</h2>
              {reviewQuery.data ? (
                <p>{t('bookings.detail.review.alreadySubmitted')}</p>
              ) : (
                <ReviewForm
                  bookingId={booking.id}
                  listingId={booking.listing_id}
                />
              )}
            </Stack>
          </Card>
        )}
      </Stack>
    </Section>
  );
}
