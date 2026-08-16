/**
 * Locale-aware relative timestamp ("2 hours ago") — `Intl.RelativeTimeFormat`,
 * per FRONTEND_ARCHITECTURE.md §17.2. A local copy of
 * `modules/notifications/utils/formatRelativeTime.js`'s exact logic
 * rather than a cross-module import: Messaging must never depend on
 * Notifications (Phase 14's hard architecture constraint), so this small,
 * generic utility is duplicated rather than shared.
 */

const UNITS = [
  { unit: 'year', seconds: 31536000 },
  { unit: 'month', seconds: 2592000 },
  { unit: 'day', seconds: 86400 },
  { unit: 'hour', seconds: 3600 },
  { unit: 'minute', seconds: 60 },
];

export function formatRelativeTime(dateString, locale) {
  const elapsedSeconds = (new Date(dateString).getTime() - Date.now()) / 1000;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  const match = UNITS.find(
    ({ seconds }) => Math.abs(elapsedSeconds) >= seconds,
  );
  if (!match) return formatter.format(Math.round(elapsedSeconds), 'second');
  return formatter.format(
    Math.round(elapsedSeconds / match.seconds),
    match.unit,
  );
}

export default formatRelativeTime;
