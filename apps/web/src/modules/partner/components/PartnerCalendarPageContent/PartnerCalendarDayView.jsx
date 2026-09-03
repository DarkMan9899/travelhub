/**
 * PartnerCalendarDayView — Partner Workspace Sprint 5, P0. One day,
 * adapted per the SELECTED unit's own real scheduling shape:
 *
 * - Time-sliced unit (`time_slot_start` populated — a tour/activity
 *   departure) -> a real hour-axis timeline (06:00-23:00,
 *   `calendarDateGrid.js`), one `TimeSlotBlock` per sibling time-sliced
 *   unit on this listing (so a tour's Morning + Afternoon departure both
 *   show, not just whichever one happens to be toggled in the resource
 *   picker above).
 * - Date-only unit (hotel room, property, vehicle, a full-day guide —
 *   `time_slot_start` is NULL) -> a plain single-day summary card, the
 *   same breakdown numbers the Month view's selection panel already
 *   shows, never a fake hourly grid. This is the P0 requirement's own
 *   explicit anti-goal ("do not make Month view artificially hourly")
 *   applied symmetrically to Day view.
 *
 * Clicking a slot/the summary card sets `unitId` + `selection` on the
 * parent exactly like clicking a Month-grid day already does — the
 * existing action-tabs panel (set availability / quick block / external
 * reservation) below is reused unmodified for either shape.
 */

import { useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Icon, Button } from '@desavii/ui/components/primitives';
import { EmptyState, Skeleton } from '@desavii/ui/components/feedback-overlays';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUnitBreakdownQuery } from '../../../availability/index.js';
import { addDays, todayIso, HOUR_ROWS } from './calendarDateGrid.js';
import TimeSlotBlock, { HOUR_ROW_HEIGHT_PX } from './TimeSlotBlock.jsx';
import styles from './PartnerCalendarDayView.module.scss';

function DateOnlySummary({ unit, date, isSelected, onSelect }) {
  const { t } = useTranslation();
  const breakdownQuery = useUnitBreakdownQuery(unit.id, date, date);
  const day = breakdownQuery.data?.[0];

  if (breakdownQuery.isPending) {
    return <Skeleton variant="rect" height={96} />;
  }

  return (
    <button
      type="button"
      className={[
        styles.summaryCard,
        isSelected && styles['summaryCard--selected'],
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onSelect(unit.id, date)}
    >
      {day ? (
        <span className={styles.summaryStats}>
          {t('partner.calendar.breakdown.total', { count: day.total })} ·{' '}
          {t('partner.calendar.breakdown.available', { count: day.available })}
        </span>
      ) : (
        <span className={styles.summaryStats}>
          {t('partner.calendar.day.noData')}
        </span>
      )}
    </button>
  );
}

DateOnlySummary.propTypes = {
  unit: PropTypes.shape({ id: PropTypes.number.isRequired }).isRequired,
  date: PropTypes.string.isRequired,
  isSelected: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};

export default function PartnerCalendarDayView({
  date,
  onDateChange,
  units,
  effectiveUnit = undefined,
  isTimeSliced,
  selection = null,
  onSelectSlot,
  locale,
}) {
  const { t } = useTranslation();
  const timeSlicedUnits = useMemo(
    () => units.filter((u) => u.time_slot_start),
    [units],
  );

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [locale],
  );

  return (
    <div className={styles.dayView}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.navButton}
          aria-label={t('partner.calendar.day.previousDay')}
          onClick={() => onDateChange(addDays(date, -1))}
        >
          <Icon icon={ChevronLeft} size="sm" />
        </button>
        <span className={styles.dateLabel}>
          {dateFormatter.format(new Date(`${date}T00:00:00Z`))}
        </span>
        <button
          type="button"
          className={styles.navButton}
          aria-label={t('partner.calendar.day.nextDay')}
          onClick={() => onDateChange(addDays(date, 1))}
        >
          <Icon icon={ChevronRight} size="sm" />
        </button>
        {date !== todayIso() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDateChange(todayIso())}
          >
            {t('partner.calendar.day.today')}
          </Button>
        )}
      </div>

      {isTimeSliced && timeSlicedUnits.length === 0 && (
        <EmptyState title={t('partner.calendar.timeline.noSlots')} />
      )}

      {isTimeSliced && timeSlicedUnits.length > 0 && (
        <div className={styles.timeline}>
          <div className={styles.hourLabels}>
            {HOUR_ROWS.map((hour) => (
              <div
                key={hour}
                className={styles.hourLabel}
                style={{ height: HOUR_ROW_HEIGHT_PX }}
              >
                {hour}
              </div>
            ))}
          </div>
          <div
            className={styles.slotsLayer}
            style={{ height: HOUR_ROWS.length * HOUR_ROW_HEIGHT_PX }}
          >
            {HOUR_ROWS.map((hour) => (
              <div
                key={hour}
                className={styles.hourGridline}
                style={{ height: HOUR_ROW_HEIGHT_PX }}
              />
            ))}
            {timeSlicedUnits.map((unit) => (
              <TimeSlotBlock
                key={unit.id}
                unit={unit}
                date={date}
                isSelected={
                  selection?.start === date && effectiveUnit?.id === unit.id
                }
                onSelect={onSelectSlot}
              />
            ))}
          </div>
        </div>
      )}

      {!isTimeSliced && effectiveUnit && (
        <DateOnlySummary
          unit={effectiveUnit}
          date={date}
          isSelected={selection?.start === date}
          onSelect={onSelectSlot}
        />
      )}
    </div>
  );
}

PartnerCalendarDayView.propTypes = {
  date: PropTypes.string.isRequired,
  onDateChange: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types -- real GET /availability/units row shape
  units: PropTypes.arrayOf(PropTypes.object).isRequired,
  // eslint-disable-next-line react/forbid-prop-types -- same
  effectiveUnit: PropTypes.object,
  isTimeSliced: PropTypes.bool.isRequired,
  selection: PropTypes.shape({
    start: PropTypes.string,
    end: PropTypes.string,
  }),
  onSelectSlot: PropTypes.func.isRequired,
  locale: PropTypes.string.isRequired,
};
