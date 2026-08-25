/**
 * BookingCheckoutPageContent — `/:locale/booking/checkout`. Converts an
 * active reservation hold (created by `ListingReservationWidget`,
 * carried here via router `state` — no server-side "cart" concept
 * exists, `POST /booking-holds`'s own response has everything this page
 * needs) into a real `PENDING_VENDOR` booking via `POST /bookings`.
 *
 * A page refresh (or any direct navigation without the router state)
 * loses that in-memory hand-off — this is a legitimate, honest empty
 * state (`noActiveHold`), not an error, since the hold itself may still
 * be valid server-side; the customer simply needs to re-select dates
 * from the listing page to resume (the same "eventual consistency,
 * never silently wrong" ethos the rest of this phase follows).
 *
 * The countdown is a client-side re-render of the same `expires_at` the
 * server already returned — never trusted as the source of truth for
 * whether the hold is still valid; the authoritative check happens
 * server-side inside `POST /bookings`, which fails plainly (a normal,
 * surfaced error) if the hold already expired.
 */

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Input, Textarea } from '@travelhub/ui/components/form-controls';
import { Button, Card } from '@travelhub/ui/components/primitives';
import { PriceTag } from '@travelhub/ui/components/data-display';
import { Alert, EmptyState } from '@travelhub/ui/components/feedback-overlays';
import { Section, Stack, Inline } from '@travelhub/ui/components/layout';
import PageHeader from '../../../../components/PageHeader/PageHeader.jsx';
import { useAuth } from '../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../contexts/ToastContext.jsx';
import useNoIndex from '../../../../seo/useNoIndex.js';
import { useListingQuery } from '../../../listings/queries/useListingQuery.js';
import getLocalizedTranslation from '../../../listings/utils/getLocalizedTranslation.js';
import { useCreateBookingMutation } from '../../mutations/useCreateBookingMutation.js';
import { useReleaseBookingHoldMutation } from '../../mutations/useReleaseBookingHoldMutation.js';

function useRemainingMs(expiresAt) {
  const [remainingMs, setRemainingMs] = useState(() =>
    expiresAt ? new Date(expiresAt).getTime() - Date.now() : 0,
  );

  useEffect(() => {
    if (!expiresAt) return undefined;
    const interval = setInterval(() => {
      setRemainingMs(new Date(expiresAt).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return Math.max(0, remainingMs);
}

export default function BookingCheckoutPageContent() {
  const { t } = useTranslation();
  const { locale } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  useNoIndex();

  const [bookingConflict, setBookingConflict] = useState(false);

  const holdState = location.state;
  const listingId = holdState?.listingId;
  const holdItem = holdState?.holdBatch?.items?.[0];
  const holdIds = holdItem?.hold_ids ?? [];
  const expiresAt = holdState?.holdBatch?.expires_at;
  const estimatedTotal = holdState?.estimatedTotal;
  // P2.2B: `ListingReservationWidget`'s own real-label resolution and the
  // customer's entered guest count, both carried through router state the
  // same way `estimatedTotal` already is — ephemeral, display/payload-only,
  // lost on a refresh same as everything else on this page (the persisted,
  // authoritative unit identity a customer sees afterward always comes
  // from the real booking response, not this hand-off).
  const unitLabel = holdState?.unitLabel;
  const guestCount = holdState?.guestCount;
  const nights =
    holdItem?.date_from && holdItem?.date_to
      ? Math.round(
          (new Date(holdItem.date_to) - new Date(holdItem.date_from)) /
            86_400_000,
        )
      : null;

  const remainingMs = useRemainingMs(expiresAt);
  const isExpired = Boolean(expiresAt) && remainingMs <= 0;

  const { data: listing } = useListingQuery(listingId);
  const translation = listing
    ? getLocalizedTranslation(listing.translations, locale)
    : null;

  const createBookingMutation = useCreateBookingMutation();
  const releaseHoldMutation = useReleaseBookingHoldMutation();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      fullName: user
        ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
        : '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      notes: '',
    },
  });

  if (!holdState || !holdItem) {
    return (
      <EmptyState
        title={t('bookings.checkout.noActiveHold.title')}
        description={t('bookings.checkout.noActiveHold.description')}
        actionLabel={t('bookings.checkout.noActiveHold.action')}
        onAction={() => navigate(`/${locale}`)}
      />
    );
  }

  async function onSubmit(values) {
    try {
      const { data } = await createBookingMutation.mutateAsync({
        items: [{ holdIds, guests: [], guestCount }],
        guestContactSnapshot: {
          fullName: values.fullName,
          email: values.email,
          phone: values.phone || undefined,
        },
        customerNotes: values.notes || undefined,
      });
      showToast(t('bookings.checkout.successToast'), { variant: 'success' });
      navigate(`/${locale}/account/bookings/${data.id}`);
    } catch (err) {
      // Phase 17 §Checkout Revalidation (CRITICAL) — `POST /bookings` only
      // ever re-checks that the holds are still active
      // (`AvailabilityService#consumeHold`); it never re-decrements
      // capacity, since that already happened atomically at
      // hold-creation time. A hold going stale between this page loading
      // and submit (expired, or released/consumed by a concurrent
      // action) is exactly the "phone reservation while a customer is
      // checking out" scenario — surfaced here as a blocking, specific
      // conflict state (not just a toast) so the customer can't retry
      // into the same wall.
      if (err?.code === 'HOLD_EXPIRED') {
        setBookingConflict(true);
      } else {
        showToast(t('bookings.checkout.submitError'), { variant: 'danger' });
      }
    }
  }

  async function handleCancelHold() {
    try {
      await releaseHoldMutation.mutateAsync(holdIds);
    } finally {
      navigate(listingId ? `/${locale}/listings/${listingId}` : `/${locale}`);
    }
  }

  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000)
    .toString()
    .padStart(2, '0');
  const isBlocked = bookingConflict || isExpired;

  return (
    <Section spacing="default">
      <PageHeader
        title={t('bookings.checkout.heading')}
        breadcrumbs={[{ label: t('nav.home'), href: `/${locale}` }]}
      />
      <Stack gap="4">
        <Card as="div" padding="lg">
          <Stack gap="3">
            <h2>{t('bookings.checkout.summary.heading')}</h2>
            {translation && <p>{translation.title ?? listing.slug}</p>}
            {unitLabel && (
              <Inline justify="space-between">
                <span>{t('bookings.checkout.summary.roomType')}</span>
                <span>{unitLabel}</span>
              </Inline>
            )}
            <Inline justify="space-between">
              <span>{t('bookings.checkout.summary.dates')}</span>
              <span>
                {holdItem.date_from} – {holdItem.date_to}
              </span>
            </Inline>
            {nights !== null && (
              <Inline justify="space-between">
                <span>{t('bookings.checkout.summary.nights')}</span>
                <span>{nights}</span>
              </Inline>
            )}
            {holdItem.quantity > 1 && (
              <Inline justify="space-between">
                <span>{t('bookings.checkout.summary.quantity')}</span>
                <span>{holdItem.quantity}</span>
              </Inline>
            )}
            {guestCount && (
              <Inline justify="space-between">
                <span>{t('bookings.checkout.summary.guests')}</span>
                <span>{guestCount}</span>
              </Inline>
            )}
            <Inline justify="space-between" align="center">
              <strong>{t('bookings.checkout.summary.total')}</strong>
              {estimatedTotal ? (
                <PriceTag
                  amount={estimatedTotal.amount}
                  currencyCode={estimatedTotal.currency}
                  suffix={t('bookings.checkout.summary.estimateSuffix')}
                />
              ) : (
                <span>{t('bookings.checkout.summary.unavailable')}</span>
              )}
            </Inline>
          </Stack>
        </Card>

        {isBlocked && (
          <Alert variant="danger">
            {t(
              bookingConflict
                ? 'bookings.checkout.conflictError'
                : 'bookings.checkout.holdExpired',
            )}
          </Alert>
        )}
        {!isBlocked && (
          <p aria-live="polite">
            {t('bookings.checkout.holdExpiresIn', { minutes, seconds })}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack gap="4">
            <Controller
              name="fullName"
              control={control}
              rules={{
                required: t('bookings.checkout.guestContact.fullNameRequired'),
              }}
              render={({ field }) => (
                <Input
                  label={t('bookings.checkout.guestContact.fullNameLabel')}
                  required
                  error={errors.fullName?.message}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...field}
                />
              )}
            />
            <Controller
              name="email"
              control={control}
              rules={{
                required: t('bookings.checkout.guestContact.emailRequired'),
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: t('bookings.checkout.guestContact.emailInvalid'),
                },
              }}
              render={({ field }) => (
                <Input
                  type="email"
                  label={t('bookings.checkout.guestContact.emailLabel')}
                  required
                  error={errors.email?.message}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...field}
                />
              )}
            />
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  type="tel"
                  label={t('bookings.checkout.guestContact.phoneLabel')}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...field}
                />
              )}
            />
            <Controller
              name="notes"
              control={control}
              render={({ field }) => (
                <Textarea
                  label={t('bookings.checkout.notesLabel')}
                  // eslint-disable-next-line react/jsx-props-no-spreading
                  {...field}
                />
              )}
            />

            <Button
              type="submit"
              variant="primary"
              disabled={isBlocked}
              loading={createBookingMutation.isPending}
            >
              {t('bookings.checkout.confirmAction')}
            </Button>
          </Stack>
        </form>

        <Button
          variant="ghost"
          onClick={() => handleCancelHold()}
          loading={releaseHoldMutation.isPending}
        >
          {t('bookings.checkout.cancelHoldAction')}
        </Button>
      </Stack>
    </Section>
  );
}
