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
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Input, Select } from '@travelhub/ui/components/form-controls';
import { Button } from '@travelhub/ui/components/primitives';
import { Stack, Inline } from '@travelhub/ui/components/layout';
import { BOOKABLE_UNIT_TYPES, BED_TYPES } from '../../../availability/index.js';
import { CURRENCY_CODES } from '../../constants/currencies.js';

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
}) {
  const { t } = useTranslation();
  const [bookableUnitType, setBookableUnitType] = useState(
    initialValues.bookableUnitType ?? BOOKABLE_UNIT_TYPES[0],
  );
  const [unitLabel, setUnitLabel] = useState(initialValues.unitLabel ?? '');
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
      unitLabel: unitLabel.trim() === '' ? undefined : unitLabel.trim(),
      capacity: toOptionalInt(capacity),
      maxGuests: toOptionalInt(maxGuests),
      bedConfiguration:
        bedRows.length > 0
          ? bedRows.map((row) => ({ type: row.type, count: Number(row.count) }))
          : undefined,
      basePriceAmount: toOptionalNumber(basePriceAmount),
      basePriceCurrency: basePriceAmount === '' ? undefined : basePriceCurrency,
    });
  }

  const priceIncomplete =
    (basePriceAmount !== '' && !basePriceCurrency) ||
    (basePriceAmount === '' && Boolean(basePriceCurrency));

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
      <Input
        label={t('partner.listingWizard.availability.unitLabel')}
        placeholder={t(
          'partner.listingWizard.availability.unitLabelPlaceholder',
        )}
        value={unitLabel}
        onChange={(event) => setUnitLabel(event.target.value)}
      />
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
      </Inline>

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

      <Inline gap="2">
        <Button
          variant="primary"
          loading={isSubmitting}
          disabled={priceIncomplete}
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
  }),
  showTypeSelector: PropTypes.bool,
  isSubmitting: PropTypes.bool,
  submitLabel: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};
