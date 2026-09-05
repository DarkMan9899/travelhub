/**
 * BookableUnitForm — the shared field set for both registering a new
 * bookable unit and editing an existing one (P2.2A). `bookableUnitType`
 * is only shown when creating (`showTypeSelector`) — changing a unit's
 * type post-creation has real booking-history implications, out of
 * scope here (see `bookableUnitService.updateUnit`'s own comment).
 *
 * `capacity` (inventory quantity — "how many rooms of this type exist")
 * and `maxGuests` (occupancy — "how many guests fit in one room") are
 * deliberately two separate fields, never conflated — the exact
 * distinction the P2.2A audit found `bookable_units.capacity` was
 * missing a counterpart for.
 *
 * Sprint 5 (Calendar P0): start/end time — real, optional `TIME` columns
 * (`bookable_units.time_slot_start/end`) already read by the Calendar's
 * Week/Day views to render a genuine hour-axis timeline for a tour/
 * activity departure. `registerUnitSchema` (backend) accepts them at
 * creation; `updateUnitSchema` deliberately does not (a departure's time
 * isn't editable post-creation, mirroring `bookableUnitType`'s own
 * create-only rule) — so, like the type selector, these fields only show
 * when `showTypeSelector` is true. Leaving both blank keeps a unit
 * date-only (a hotel room, a vehicle, a full-day guide) — this is an
 * opt-in field, never a forced one.
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@desavii/ui/components/form-controls';
import { Button } from '@desavii/ui/components/primitives';
import { Stack, Inline } from '@desavii/ui/components/layout';
import {
  BOOKABLE_UNIT_TYPES,
  BED_TYPES,
  BATHROOM_TYPES,
  VIEW_TYPES,
  SMOKING_POLICIES,
} from '../../../availability/index.js';
import { CURRENCY_CODES } from '../../constants/currencies.js';
import RoomDescriptionEditor from './RoomDescriptionEditor.jsx';
import RoomAmenitiesEditor from './RoomAmenitiesEditor.jsx';
import RoomMediaGallery from './RoomMediaGallery.jsx';

// Sprint C-1 §17 — room-specific fields (size/bathroom/view/smoking,
// description/amenities/photos) are gated to this one unit type. Generic
// on the schema (any unit type could in principle carry room_size_sqm/
// bathroom_type/etc., same as maxGuests/bedConfiguration already are) but
// only ever shown here for a HOTEL_ROOM — a Tour departure or a Car
// Rental vehicle never sees a bathroom/view/smoking field or a photo
// gallery upload.
const HOTEL_ROOM_TYPE = 'HOTEL_ROOM';

function toOptionalInt(value) {
  return value === '' ? undefined : Number(value);
}

function toOptionalNumber(value) {
  return value === '' ? undefined : Number(value);
}

function emptyBedRow() {
  return { type: BED_TYPES[0], count: '1' };
}

export default function BookableUnitForm({
  initialValues = {},
  showTypeSelector = false,
  isSubmitting = false,
  submitLabel,
  onSubmit,
  onCancel = undefined,
  // Sprint C-1: only present when editing an already-created unit — the
  // description/amenities/photo sub-editors need a real unit id, so they
  // never render while `showTypeSelector` (creating) is true.
  unitId = null,
  listingId = null,
  categoryId = null,
  translations = [],
  amenityIds = [],
  media = [],
}) {
  const { t } = useTranslation();
  const [bookableUnitType, setBookableUnitType] = useState(
    initialValues.bookableUnitType ?? BOOKABLE_UNIT_TYPES[0],
  );
  const [unitLabel, setUnitLabel] = useState(initialValues.unitLabel ?? '');
  const [timeSlotStart, setTimeSlotStart] = useState(
    initialValues.timeSlotStart ?? '',
  );
  const [timeSlotEnd, setTimeSlotEnd] = useState(
    initialValues.timeSlotEnd ?? '',
  );
  const [capacity, setCapacity] = useState(
    initialValues.capacity != null ? String(initialValues.capacity) : '',
  );
  const [maxGuests, setMaxGuests] = useState(
    initialValues.maxGuests != null ? String(initialValues.maxGuests) : '',
  );
  const [bedRows, setBedRows] = useState(
    initialValues.bedConfiguration?.length > 0
      ? initialValues.bedConfiguration.map((row) => ({
          type: row.type,
          count: String(row.count),
        }))
      : [],
  );
  const [basePriceAmount, setBasePriceAmount] = useState(
    initialValues.basePriceAmount != null
      ? String(initialValues.basePriceAmount)
      : '',
  );
  const [basePriceCurrency, setBasePriceCurrency] = useState(
    initialValues.basePriceCurrency ?? null,
  );
  // Sprint C-1 (Accommodation room-level product data).
  const [roomSizeSqm, setRoomSizeSqm] = useState(
    initialValues.roomSizeSqm != null ? String(initialValues.roomSizeSqm) : '',
  );
  const [bathroomType, setBathroomType] = useState(
    initialValues.bathroomType ?? null,
  );
  const [viewType, setViewType] = useState(initialValues.viewType ?? null);
  const [smokingPolicy, setSmokingPolicy] = useState(
    initialValues.smokingPolicy ?? null,
  );

  const isHotelRoom = bookableUnitType === HOTEL_ROOM_TYPE;

  function addBedRow() {
    setBedRows((rows) => [...rows, emptyBedRow()]);
  }

  function updateBedRow(index, patch) {
    setBedRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function removeBedRow(index) {
    setBedRows((rows) => rows.filter((_, i) => i !== index));
  }

  function handleSubmit() {
    onSubmit({
      ...(showTypeSelector ? { bookableUnitType } : {}),
      ...(showTypeSelector
        ? {
            timeSlotStart: timeSlotStart === '' ? undefined : timeSlotStart,
            timeSlotEnd: timeSlotEnd === '' ? undefined : timeSlotEnd,
          }
        : {}),
      unitLabel: unitLabel.trim() === '' ? undefined : unitLabel.trim(),
      capacity: toOptionalInt(capacity),
      maxGuests: toOptionalInt(maxGuests),
      bedConfiguration:
        bedRows.length > 0
          ? bedRows.map((row) => ({ type: row.type, count: Number(row.count) }))
          : undefined,
      basePriceAmount: toOptionalNumber(basePriceAmount),
      basePriceCurrency: basePriceAmount === '' ? undefined : basePriceCurrency,
      ...(isHotelRoom
        ? {
            roomSizeSqm: toOptionalNumber(roomSizeSqm),
            bathroomType: bathroomType ?? undefined,
            viewType: viewType ?? undefined,
            smokingPolicy: smokingPolicy ?? undefined,
          }
        : {}),
    });
  }

  const priceIncomplete =
    (basePriceAmount !== '' && !basePriceCurrency) ||
    (basePriceAmount === '' && Boolean(basePriceCurrency));
  const timeSlotIncomplete =
    (timeSlotStart !== '' && timeSlotEnd === '') ||
    (timeSlotStart === '' && timeSlotEnd !== '');
  const timeSlotOutOfOrder =
    timeSlotStart !== '' && timeSlotEnd !== '' && timeSlotEnd <= timeSlotStart;

  return (
    <Stack gap="4">
      {showTypeSelector && (
        <Select
          label={t('partner.listingWizard.availability.unitType')}
          placeholder={t('partner.listingWizard.selectPlaceholder')}
          options={BOOKABLE_UNIT_TYPES.map((code) => ({
            value: code,
            label: t(`partner.listingWizard.bookableUnitTypes.${code}`, code),
          }))}
          value={bookableUnitType}
          onChange={setBookableUnitType}
        />
      )}
      {isHotelRoom && (
        <p>{t('partner.listingWizard.availability.roomBasicsHeading')}</p>
      )}
      <Input
        label={t('partner.listingWizard.availability.unitLabel')}
        placeholder={t(
          'partner.listingWizard.availability.unitLabelPlaceholder',
        )}
        value={unitLabel}
        onChange={(event) => setUnitLabel(event.target.value)}
      />
      {showTypeSelector && (
        <Inline gap="4" wrap align="flex-end">
          <Input
            type="time"
            label={t('partner.listingWizard.availability.timeSlotStart')}
            helperText={t('partner.listingWizard.availability.timeSlotHint')}
            value={timeSlotStart}
            onChange={(event) => setTimeSlotStart(event.target.value)}
          />
          <Input
            type="time"
            label={t('partner.listingWizard.availability.timeSlotEnd')}
            value={timeSlotEnd}
            onChange={(event) => setTimeSlotEnd(event.target.value)}
            error={
              timeSlotOutOfOrder
                ? t('partner.listingWizard.availability.timeSlotOutOfOrder')
                : undefined
            }
          />
        </Inline>
      )}
      {showTypeSelector && timeSlotIncomplete && (
        <p>{t('partner.listingWizard.availability.timeSlotIncomplete')}</p>
      )}
      <Inline gap="4" wrap>
        <Input
          type="number"
          label={t('partner.listingWizard.availability.capacity')}
          helperText={t('partner.listingWizard.availability.capacityHint')}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
        <Input
          type="number"
          label={t('partner.listingWizard.availability.maxGuests')}
          helperText={t('partner.listingWizard.availability.maxGuestsHint')}
          value={maxGuests}
          onChange={(event) => setMaxGuests(event.target.value)}
        />
        {isHotelRoom && (
          <Input
            type="number"
            label={t('partner.listingWizard.availability.roomSizeSqm')}
            helperText={t('partner.listingWizard.availability.roomSizeSqmHint')}
            min="1"
            max="1000"
            value={roomSizeSqm}
            onChange={(event) => setRoomSizeSqm(event.target.value)}
          />
        )}
      </Inline>

      {isHotelRoom && (
        <p>{t('partner.listingWizard.availability.roomSleepingHeading')}</p>
      )}
      <Stack gap="2">
        <p>{t('partner.listingWizard.availability.bedConfiguration')}</p>
        {bedRows.map((row, index) => (
          // eslint-disable-next-line react/no-array-index-key -- rows have no stable identity of their own until saved
          <Inline key={index} gap="2" align="flex-end">
            <Select
              label={t('partner.listingWizard.availability.bedType')}
              options={BED_TYPES.map((code) => ({
                value: code,
                label: t(`partner.listingWizard.bedTypes.${code}`, code),
              }))}
              value={row.type}
              onChange={(value) => updateBedRow(index, { type: value })}
            />
            <Input
              type="number"
              label={t('partner.listingWizard.availability.bedCount')}
              value={row.count}
              onChange={(event) =>
                updateBedRow(index, { count: event.target.value })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeBedRow(index)}
            >
              {t('partner.listingWizard.availability.removeBed')}
            </Button>
          </Inline>
        ))}
        <Button variant="secondary" size="sm" onClick={() => addBedRow()}>
          {t('partner.listingWizard.availability.addBed')}
        </Button>
      </Stack>

      {isHotelRoom && (
        <Stack gap="3">
          <p>{t('partner.listingWizard.availability.roomFeaturesHeading')}</p>
          <Inline gap="4" wrap>
            <Select
              label={t('partner.listingWizard.availability.bathroomType')}
              placeholder={t('partner.listingWizard.selectPlaceholder')}
              options={BATHROOM_TYPES.map((code) => ({
                value: code,
                label: t(`partner.listingWizard.bathroomTypes.${code}`, code),
              }))}
              value={bathroomType}
              onChange={setBathroomType}
            />
            <Select
              label={t('partner.listingWizard.availability.viewType')}
              placeholder={t('partner.listingWizard.selectPlaceholder')}
              options={VIEW_TYPES.map((code) => ({
                value: code,
                label: t(`partner.listingWizard.viewTypes.${code}`, code),
              }))}
              value={viewType}
              onChange={setViewType}
            />
            <Select
              label={t('partner.listingWizard.availability.smokingPolicy')}
              placeholder={t('partner.listingWizard.selectPlaceholder')}
              options={SMOKING_POLICIES.map((code) => ({
                value: code,
                label: t(`partner.listingWizard.smokingPolicies.${code}`, code),
              }))}
              value={smokingPolicy}
              onChange={setSmokingPolicy}
            />
          </Inline>
        </Stack>
      )}

      {isHotelRoom && (
        <p>{t('partner.listingWizard.availability.roomPricingHeading')}</p>
      )}
      <Inline gap="4" wrap>
        <Input
          type="number"
          label={t('partner.listingWizard.availability.basePriceAmount')}
          value={basePriceAmount}
          onChange={(event) => setBasePriceAmount(event.target.value)}
        />
        <Select
          label={t('partner.listingWizard.availability.basePriceCurrency')}
          placeholder={t('partner.listingWizard.selectPlaceholder')}
          options={CURRENCY_CODES.map((code) => ({ value: code, label: code }))}
          value={basePriceCurrency}
          onChange={setBasePriceCurrency}
        />
      </Inline>
      {priceIncomplete && (
        <p>{t('partner.listingWizard.availability.basePriceIncomplete')}</p>
      )}

      {/* Sprint C-1: description/amenities/photos need a real, already-
          created unit — never shown while registering a brand-new room
          (`unitId` is only ever passed when editing). */}
      {isHotelRoom && unitId && (
        <RoomDescriptionEditor
          unitId={unitId}
          listingId={listingId}
          translations={translations}
        />
      )}
      {isHotelRoom && unitId && (
        <RoomAmenitiesEditor
          unitId={unitId}
          listingId={listingId}
          categoryId={categoryId}
          amenityIds={amenityIds}
        />
      )}
      {isHotelRoom && unitId && (
        <RoomMediaGallery unitId={unitId} listingId={listingId} media={media} />
      )}

      <Inline gap="2">
        <Button
          variant="primary"
          loading={isSubmitting}
          disabled={priceIncomplete || timeSlotIncomplete || timeSlotOutOfOrder}
          onClick={() => handleSubmit()}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            {t('partner.listingWizard.cancel')}
          </Button>
        )}
      </Inline>
    </Stack>
  );
}

BookableUnitForm.propTypes = {
  initialValues: PropTypes.shape({
    bookableUnitType: PropTypes.string,
    unitLabel: PropTypes.string,
    timeSlotStart: PropTypes.string,
    timeSlotEnd: PropTypes.string,
    capacity: PropTypes.number,
    maxGuests: PropTypes.number,
    bedConfiguration: PropTypes.arrayOf(
      PropTypes.shape({
        type: PropTypes.string,
        count: PropTypes.number,
      }),
    ),
    basePriceAmount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    basePriceCurrency: PropTypes.string,
    roomSizeSqm: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    bathroomType: PropTypes.string,
    viewType: PropTypes.string,
    smokingPolicy: PropTypes.string,
  }),
  showTypeSelector: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  submitLabel: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
  unitId: PropTypes.number,
  listingId: PropTypes.number,
  categoryId: PropTypes.number,
  translations: PropTypes.arrayOf(
    PropTypes.shape({
      language_code: PropTypes.string.isRequired,
      description: PropTypes.string,
    }),
  ),
  amenityIds: PropTypes.arrayOf(PropTypes.number),
  media: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      url: PropTypes.string.isRequired,
      thumbnail_url: PropTypes.string,
      position: PropTypes.number.isRequired,
      is_cover: PropTypes.bool.isRequired,
    }),
  ),
};
