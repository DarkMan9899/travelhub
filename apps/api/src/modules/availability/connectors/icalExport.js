/**
 * Builds a minimal, valid iCalendar feed from TravelHub's own occupied
 * ranges (Phase 17 §20 — export). Deliberately exposes nothing
 * customer-identifying: `SUMMARY` is a generic "Reserved" label, never a
 * guest name/email/phone, even though `external_reservations`/`bookings`
 * may carry that data internally — an external calendar consumer only
 * ever needs to know a date range is occupied.
 */

function toIcsDate(isoDate) {
  return isoDate.replace(/-/g, '');
}

function addDaysIso(isoDate, delta) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function foldLine(line) {
  // RFC 5545 §3.1 recommends folding at 75 octets — not required for
  // correctness with the short lines this generator produces, so this
  // stays a no-op passthrough; kept as a named step so a future longer
  // SUMMARY/DESCRIPTION doesn't silently violate the spec.
  return line;
}

/**
 * @param {{calendarName:string, occupiedRanges: Array<{dateFrom:string, dateTo:string, reference:string}>}} input
 * @returns {string} raw .ics text
 */
export function buildIcsExport({ calendarName, occupiedRanges }) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//desavii//Inventory Export//EN',
    `X-WR-CALNAME:${calendarName}`,
    'CALSCALE:GREGORIAN',
  ];

  occupiedRanges.forEach((range, index) => {
    // date_to is the last occupied night (this platform's own
    // accommodation semantics) — iCal DTEND is exclusive, so +1 day.
    const dtEnd = addDaysIso(range.dateTo, 1);
    lines.push(
      'BEGIN:VEVENT',
      `UID:travelhub-${range.reference}-${index}@travelhub.local`,
      `DTSTART;VALUE=DATE:${toIcsDate(range.dateFrom)}`,
      `DTEND;VALUE=DATE:${toIcsDate(dtEnd)}`,
      'SUMMARY:Reserved',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n');
}

export default buildIcsExport;
