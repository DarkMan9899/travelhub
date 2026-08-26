/**
 * ListingReservationWidget — Phase 7 (Booking Flow)'s replacement for the
 * old `ListingBookingCta` (toast-only placeholder): a real unit selector
 * (only shown when a listing has more than one bookable unit — see
 * `useListingBookableUnitsQuery.js`'s own header for the auto-select-vs-
 * ambiguous rule), a date-range picker with blocked days disabled from
 * the live calendar, an optional quantity stepper (only shown for a
 * shared-capacity unit, `capacity > 1`), a client-side estimated total
 * (explicitly labeled an estimate — the authoritative price is always
 * resolved server-side at booking-creation time, never trusted from this
 * calculation), and a "Request to Book" action that creates a
 * reservation hold and hands off to `BookingCheckoutPageContent`.
 *
 * A listing with zero registered bookable units (a partner hasn't set up
 * inventory yet) is a legitimate, honest state — not an error — so the
 * widget still shows the price with a plain "not bookable yet" message
 * rather than hiding entirely.
 *
 * The base-price `PriceTag`'s `suffix` carries the pricing-model label
 * (e.g. "per night") directly — this used to be a separate
 * `ListingPricingSection` rendered right below this widget, showing the
 * exact same amount a second time; merged here to remove that
 * duplicate price display.
 */

import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { PriceTag } from '@desavii/ui/components/data-display';
import { Button } from '@desavii/ui/components/primitives';
import {
  Select,
  Input,
  DatePicker,
} from '@desavii/ui/components/form-controls';
import { Section, Stack, Inline } from '@desavii/ui/components/layout';
import { Spinner, ErrorState } from '@desavii/ui/components/feedback-overlays';
import { useAuth } from '../../../../../contexts/AuthContext.jsx';
import { useToast } from '../../../../../contexts/ToastContext.jsx';
import { useListingBookableUnitsQuery } from '../../../queries/useListingBookableUnitsQuery.js';
import { useListingCalendarQuery } from '../../../queries/useListingCalendarQuery.js';
import { useListingDayStatusQuery } from '../../../queries/useListingDayStatusQuery.js';
import { useCreateBookingHoldMutation } from '../../../../bookings/mutations/useCreateBookingHoldMutation.js';
import {
  addDays,
  toISODate,
  computeEstimatedTotal,
} from '../../../utils/reservationEstimate.js';
import {
  resolveBookingCtaLabel,
  resolvePricingModelLabel,
} from '../../../utils/reservationLabels.js';
import { formatBedConfiguration } from '../../../utils/bedConfigurationDisplay.js';
import styles from './ListingReservationWidget.module.scss';

const CALENDAR_WINDOW_DAYS = 180;

export default function ListingReservationWidget({
  listingId,
  pricing = null,
  bookingCtaKey = 'pages.listingDetail.reservation.requestToBook',
}) {
  const { t, i18n } = useTranslation();
  const { locale } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [quantity, setQuantity] = useState(1);
  const [guestCount, setGuestCount] = useState(1);

  const {
    data: units,
    isPending: isUnitsPending,
    isError: isUnitsError,
    refetch: refetchUnits,
  } = useListingBookableUnitsQuery(listingId);

  const effectiveUnitId =
    selectedUnitId ?? (units?.length === 1 ? units[0].id : null);
  const selectedUnit =
    units?.find((unit) => unit.id === effectiveUnitId) ?? null;

  // P2.2B: the unit's own real `unit_label` (e.g. "Deluxe King") when a
  // partner set one, falling back to the generic type label only for a
  // legacy unit with no label — never a bare "Type #N" ordinal anymore.
  function resolveUnitDisplayLabel(unit) {
    if (!unit) return null;
    return (
      unit.unit_label ||
      t(`partner.listingWizard.bookableUnitTypes.${unit.bookable_unit_type}`, {
        defaultValue: unit.bookable_unit_type,
      })
    );
  }

  const today = toISODate(new Date());
  const windowEnd = addDays(today, CALENDAR_WINDOW_DAYS);

  const { data: calendarDays, refetch: refetchCalendar } =
    useListingCalendarQuery(listingId, effectiveUnitId, {
      from: today,
      to: windowEnd,
    });

  // Phase 18 (Availability UX fix) — the authoritative per-day source for
  // which days are actually selectable. `calendarDays` above is kept only
  // for its per-day price; its own `status` field is blind to a day whose
  // `quantity_available` a manual block or external reservation already
  // consumed to zero (see `useListingDayStatusQuery.js`'s header) so it is
  // never used to decide `disabledDates` here.
  const { data: dayStatuses, refetch: refetchDayStatus } =
    useListingDayStatusQuery(listingId, effectiveUnitId, {
      from: today,
      to: windowEnd,
    });

  const priceByDate = useMemo(() => {
    const map = {};
    (calendarDays ?? []).forEach((day) => {
      map[day.date] = day;
    });
    return map;
  }, [calendarDays]);

  const disabledDates = useMemo(
    () =>
      (dayStatuses ?? [])
        .filter((day) => day.availability_status === 'SOLD_OUT')
        .map((day) => day.date),
    [dayStatuses],
  );

  const estimatedTotal = useMemo(
    () =>
      computeEstimatedTotal(
        dateRange,
        priceByDate,
        quantity,
        selectedUnit?.bookable_unit_type,
      ),
    [dateRange, priceByDate, quantity, selectedUnit],
  );

  const pricingModelLabel = resolvePricingModelLabel(t, pricing);

  // P2.2B: once a unit is selected, its own real base price (P2.2A rung 2
  // of the same date-override -> unit-base -> listing-fallback precedence
  // `bookingService.js#resolveItem` resolves server-side) replaces the
  // static listing-level headline price — a listing whose room types
  // carry different base prices no longer shows one misleading number
  // regardless of which unit the customer picked. A unit with no base
  // price of its own (legacy, or never set) truthfully falls back to the
  // listing price server-side too, so the headline keeps showing exactly
  // that here. Before any unit is selected, behavior is unchanged.
  const headlinePricing =
    selectedUnit?.base_price_amount !== undefined &&
    selectedUnit?.base_price_amount !== null
      ? {
          amount: selectedUnit.base_price_amount,
          currency: selectedUnit.base_price_currency,
        }
      : pricing;

  const allowedGuests =
    selectedUnit?.max_guests !== undefined && selectedUnit?.max_guests !== null
      ? selectedUnit.max_guests * quantity
      : null;

  const bedConfigurationSummary = selectedUnit
    ? formatBedConfiguration(t, selectedUnit.bed_configuration)
    : null;

  const createHoldMutation = useCreateBookingHoldMutation();
  const canSubmit =
    Boolean(effectiveUnitId) &&
    Boolean(dateRange.start) &&
    Boolean(dateRange.end);

  function handleSelectUnit(value) {
    setSelectedUnitId(Number(value));
    setDateRange({ start: null, end: null });
    setQuantity(1);
    setGuestCount(1);
  }

  function handleChangeQuantity(nextQuantity) {
    const clampedQuantity = Math.max(
      1,
      Math.min(selectedUnit.capacity, nextQuantity || 1),
    );
    setQuantity(clampedQuantity);
    // A shrinking quantity can shrink the allowed guest cap
    // (max_guests x quantity) below the guest count already entered —
    // re-clamp so the two fields never drift into an invalid combination.
    if (
      selectedUnit?.max_guests !== undefined &&
      selectedUnit?.max_guests !== null
    ) {
      setGuestCount((current) =>
        Math.min(current, selectedUnit.max_guests * clampedQuantity),
      );
    }
  }

  function handleChangeGuestCount(nextGuestCount) {
    const raw = Number(nextGuestCount) || 1;
    setGuestCount(
      allowedGuests !== null
        ? Math.min(allowedGuests, Math.max(1, raw))
        : Math.max(1, raw),
    );
  }

  async function handleRequestToBook() {
    if (!isAuthenticated) {
      const redirectTarget = encodeURIComponent(
        `/${locale}/listings/${listingId}`,
      );
      navigate(`/${locale}/auth/login?redirect=${redirectTarget}`);
      return;
    }
    try {
      const { data } = await createHoldMutation.mutateAsync([
        {
          bookableUnitId: effectiveUnitId,
          dateFrom: dateRange.start,
          dateTo: dateRange.end,
          quantity,
        },
      ]);
      navigate(`/${locale}/booking/checkout`, {
        // Phase 12 (Product Polish): the already-computed client estimate
        // rides along so checkout can show a real price summary card
        // without a new backend endpoint — still explicitly labeled an
        // estimate there too, same as here. P2.2B additive: `unitLabel`
        // (this widget's own real-label resolution, so checkout never has
        // to re-derive it) and `guestCount` — both ephemeral, display/
        // payload-only hand-off, same category as `estimatedTotal`; the
        // persisted, authoritative unit identity checkout/history read
        // afterward always comes from the real booking response instead.
        state: {
          listingId,
          holdBatch: data,
          estimatedTotal,
          unitLabel: resolveUnitDisplayLabel(selectedUnit),
          guestCount,
        },
      });
    } catch (err) {
      // Phase 17 §Checkout Revalidation — the authoritative capacity
      // check happens server-side inside `reserveCapacity` (row-locked
      // against `availability_calendar`), so a customer whose calendar
      // went stale between page load and this click can genuinely lose
      // the race to another booking/manual block. Surfacing the specific
      // conflict codes (rather than the generic holdError) and refetching
      // the calendar keeps the disabled-dates picker honest immediately
      // afterward, instead of letting the customer retry into the same
      // wall.
      const isConflict =
        err?.code === 'AVAILABILITY_CONFLICT' || err?.code === 'BLACKOUT_DATE';
      showToast(
        t(
          isConflict
            ? 'pages.listingDetail.reservation.availabilityConflict'
            : 'pages.listingDetail.reservation.holdError',
        ),
        { variant: 'danger' },
      );
      if (isConflict) {
        setDateRange({ start: null, end: null });
        refetchCalendar();
        refetchDayStatus();
      }
    }
  }

  if (isUnitsPending) {
    return (
      <Section spacing="none">
        <Spinner label={t('pages.listingDetail.loading')} />
      </Section>
    );
  }

  if (isUnitsError) {
    return (
      <Section spacing="none">
        <ErrorState
          title={t('pages.listingDetail.errorTitle')}
          retryLabel={t('pages.listingDetail.retry')}
          onRetry={refetchUnits}
        />
      </Section>
    );
  }

  if (!units || units.length === 0) {
    return (
      <Section spacing="none" className={styles.widget}>
        <Inline gap="4" justify="space-between">
          {pricing && (
            <PriceTag
              amount={pricing.amount}
              currencyCode={pricing.currency}
              locale={locale}
              suffix={pricingModelLabel}
              size="lg"
            />
          )}
          <p>{t('pages.listingDetail.reservation.noUnitsAvailable')}</p>
        </Inline>
      </Section>
    );
  }

  // P2.2B: real `unit_label` (never a bare "Type #N" ordinal when the
  // partner actually named the unit), with the unit's own known
  // `max_guests` appended — reuses the same `maxGuestsSummary` string the
  // partner-side BookableUnitsManager already shows for the identical
  // data, rather than inventing new copy for it.
  const unitOptions = units.map((unit) => {
    const baseLabel = resolveUnitDisplayLabel(unit);
    const guestsSuffix =
      unit.max_guests !== undefined && unit.max_guests !== null
        ? ` — ${t('partner.listingWizard.availability.maxGuestsSummary', { count: unit.max_guests })}`
        : '';
    return {
      value: unit.id,
      label: `${baseLabel}${guestsSuffix}`,
    };
  });

  return (
    <Section spacing="none" className={styles.widget}>
      <Stack gap="4">
        {headlinePricing && (
          <PriceTag
            amount={headlinePricing.amount}
            currencyCode={headlinePricing.currency}
            locale={locale}
            suffix={pricingModelLabel}
            size="lg"
          />
        )}

        {units.length > 1 && (
          <Select
            label={t('pages.listingDetail.reservation.unitLabel')}
            options={unitOptions}
            value={selectedUnitId ?? ''}
            onChange={(value) => handleSelectUnit(value)}
            placeholder={t('pages.listingDetail.reservation.unitPlaceholder')}
          />
        )}

        {bedConfigurationSummary && <p>{bedConfigurationSummary}</p>}

        <DatePicker
          mode="range"
          label={t('pages.listingDetail.reservation.datesLabel')}
          value={dateRange}
          onChange={setDateRange}
          minDate={today}
          disabledDates={disabledDates}
          locale={i18n.language}
          previousMonthLabel={t(
            'partner.listingWizard.datePicker.previousMonth',
          )}
          nextMonthLabel={t('partner.listingWizard.datePicker.nextMonth')}
          placeholder={t('partner.listingWizard.datePicker.selectDate')}
        />

        {selectedUnit && selectedUnit.capacity > 1 && (
          <Input
            type="number"
            label={t('pages.listingDetail.reservation.quantityLabel')}
            value={quantity}
            min={1}
            max={selectedUnit.capacity}
            onChange={(event) =>
              handleChangeQuantity(Number(event.target.value))
            }
          />
        )}

        {selectedUnit && (
          <Input
            type="number"
            label={t('pages.listingDetail.reservation.guestsLabel')}
            value={guestCount}
            min={1}
            max={allowedGuests ?? undefined}
            helperText={
              allowedGuests !== null
                ? t('pages.listingDetail.reservation.guestsHint', {
                    max: allowedGuests,
                  })
                : undefined
            }
            onChange={(event) =>
              handleChangeGuestCount(Number(event.target.value))
            }
          />
        )}

        {estimatedTotal && (
          <PriceTag
            amount={estimatedTotal.amount}
            currencyCode={estimatedTotal.currency}
            locale={locale}
            suffix={t('pages.listingDetail.reservation.estimatedTotal')}
          />
        )}

        <Button
          variant="primary"
          size="lg"
          disabled={!canSubmit}
          loading={createHoldMutation.isPending}
          onClick={() => handleRequestToBook()}
        >
          {resolveBookingCtaLabel(t, bookingCtaKey)}
        </Button>
      </Stack>
    </Section>
  );
}

ListingReservationWidget.propTypes = {
  listingId: PropTypes.number.isRequired,
  pricing: PropTypes.shape({
    amount: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    currency: PropTypes.string,
    pricing_model: PropTypes.string,
  }),
  bookingCtaKey: PropTypes.string,
};
