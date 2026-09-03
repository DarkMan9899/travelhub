/**
 * StatusStepper — Customer Account redesign (2026): a real progress
 * indicator built entirely from `booking.status` (the single source of
 * truth every other booking view already reads) — never a fabricated
 * multi-event history. Unlike Admin's `bookingDetail.history` (a real
 * `booking_status_history` read), the customer-facing booking endpoint
 * exposes no history array, so this intentionally shows only "where the
 * booking is now on its one linear path," not a timestamped log.
 *
 * Step labels reuse `bookings.status.*` (already shown on every
 * `BookingStatusBadge`) rather than a second, near-duplicate translation
 * set — the same word reads naturally as both a status badge and a step
 * label ("Confirmed").
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import styles from './StatusStepper.module.scss';

// Each branch is the full path for that terminal/current status: every
// entry before the last is "done", the last one carries `tone`.
const PATHS = {
  PENDING_VENDOR: [{ key: 'requested', tone: 'done' }, { key: 'CONFIRMED' }],
  CONFIRMED: [
    { key: 'requested', tone: 'done' },
    { key: 'CONFIRMED', tone: 'done' },
    { key: 'COMPLETED' },
  ],
  COMPLETED: [
    { key: 'requested', tone: 'done' },
    { key: 'CONFIRMED', tone: 'done' },
    { key: 'COMPLETED', tone: 'done' },
  ],
  REJECTED: [
    { key: 'requested', tone: 'done' },
    { key: 'REJECTED', tone: 'stopped' },
  ],
  CANCELLED_BY_CUSTOMER: [
    { key: 'requested', tone: 'done' },
    { key: 'CONFIRMED', tone: 'done' },
    { key: 'CANCELLED_BY_CUSTOMER', tone: 'stopped' },
  ],
  CANCELLED_BY_VENDOR: [
    { key: 'requested', tone: 'done' },
    { key: 'CONFIRMED', tone: 'done' },
    { key: 'CANCELLED_BY_VENDOR', tone: 'stopped' },
  ],
  NO_SHOW: [
    { key: 'requested', tone: 'done' },
    { key: 'CONFIRMED', tone: 'done' },
    { key: 'NO_SHOW', tone: 'stopped' },
  ],
  EXPIRED: [
    { key: 'requested', tone: 'done' },
    { key: 'EXPIRED', tone: 'stopped' },
  ],
};

export default function StatusStepper({ status }) {
  const { t } = useTranslation();
  const path = PATHS[status];
  if (!path) return null;

  return (
    <ol className={styles.stepper}>
      {path.map((step, index) => {
        const isLast = index === path.length - 1;
        const tone = step.tone ?? (isLast ? 'current' : 'done');
        const label =
          step.key === 'requested'
            ? t('bookings.detail.stepper.requested')
            : t(`bookings.status.${step.key}`);
        return (
          <li key={step.key} className={styles.step}>
            <span
              className={[styles.marker, styles[`marker--${tone}`]].join(' ')}
              aria-hidden="true"
            >
              {tone === 'done' && <Check size={12} />}
              {tone === 'stopped' && <X size={12} />}
            </span>
            <span className={styles.label}>{label}</span>
            {!isLast && (
              <span
                className={[
                  styles.connector,
                  styles[`connector--${tone}`],
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

StatusStepper.propTypes = {
  status: PropTypes.string.isRequired,
};
