/**
 * Pure day-by-day calendar expansion — Sprint 9's `GET /availability/
 * :listingId/calendar`. Turns a `[from, to]` date span, a unit's real
 * `availability_calendar` rows, and its complementary `blackout_dates`
 * veto ranges into one `{date, status}` entry per day.
 *
 * Precedence per day: a matching blackout range forces `BLOCKED`
 * regardless of what the calendar says (`BOOKING_ENGINE_ARCHITECTURE.md`
 * §11.5: blackout is "a hard veto... before the availability algorithms
 * run"); otherwise the day uses its `availability_calendar` row's status
 * if one exists, else defaults to `AVAILABLE` (only exceptions are ever
 * written — `BOOKED`/`HELD` never appear here, since this sprint's write
 * path never produces them).
 *
 * Domain layer (`core` may depend only on `core`) — no database access.
 * Dates are plain `YYYY-MM-DD` strings throughout (never `Date` objects);
 * lexicographic string comparison is chronological comparison for that
 * format, which keeps this function trivially correct and timezone-free.
 */

export const CALENDAR_DAY_STATUSES = Object.freeze(['AVAILABLE', 'BLOCKED']);

function isVetoedByBlackout(dateStr, blockedRanges) {
  return blockedRanges.some(
    (range) => range.dateFrom <= dateStr && range.dateTo >= dateStr,
  );
}

/**
 * Every `YYYY-MM-DD` date from `from` to `to`, inclusive. Shared by
 * `expandCalendarDays` (below) and by
 * `AvailabilityService`/`mysqlAvailabilityCalendarRepository.js`'s
 * range-write path, which upserts one `availability_calendar` row per
 * date in a requested range.
 *
 * @param {string} from - 'YYYY-MM-DD', inclusive
 * @param {string} to - 'YYYY-MM-DD', inclusive
 * @returns {string[]}
 */
export function enumerateDates(from, to) {
  if (from > to) {
    throw new RangeError(
      `Invalid date span: "from" (${from}) is after "to" (${to}).`,
    );
  }
  const dates = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

/**
 * @param {string} from - 'YYYY-MM-DD', inclusive
 * @param {string} to - 'YYYY-MM-DD', inclusive
 * @param {object} [sources]
 * @param {Record<string, 'AVAILABLE'|'BLOCKED'>} [sources.calendarByDate] -
 *   real `availability_calendar` statuses, keyed by 'YYYY-MM-DD'
 * @param {Array<{dateFrom: string, dateTo: string}>} [sources.blockedRanges] -
 *   `blackout_dates` veto ranges
 * @returns {Array<{date: string, status: 'AVAILABLE'|'BLOCKED'}>}
 */
export function expandCalendarDays(
  from,
  to,
  { calendarByDate = {}, blockedRanges = [] } = {},
) {
  return enumerateDates(from, to).map((dateStr) => ({
    date: dateStr,
    status: isVetoedByBlackout(dateStr, blockedRanges)
      ? 'BLOCKED'
      : (calendarByDate[dateStr] ?? 'AVAILABLE'),
  }));
}

export default { CALENDAR_DAY_STATUSES, enumerateDates, expandCalendarDays };
