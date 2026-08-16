/**
 * Minimal, dependency-free iCalendar (RFC 5545) VEVENT parser (Phase 17
 * §19). Hand-rolled rather than a third-party package — mirrors this
 * codebase's own "a real, deterministic, zero-external-dependency
 * default" precedent (`LocalPaymentProvider`, `ConsoleEmailProvider`).
 *
 * **Documented limitations (Phase 17 §19: "do not treat iCal as perfect
 * real-time hotel inventory")**:
 * - Only unfolds CRLF/LF line continuations and reads `UID`, `DTSTART`,
 *   `DTEND`, `SUMMARY`, `STATUS` per VEVENT — every other iCal property
 *   (organizer, attendees, alarms, attachments) is ignored.
 * - `RRULE` (recurrence) is NOT expanded — a recurring event contributes
 *   only its first occurrence. Most OTA/PMS export feeds (Airbnb, VRBO,
 *   Booking.com) emit one VEVENT per stay rather than RRULEs, so this
 *   covers the real-world common case; a feed relying on RRULE expansion
 *   needs a future enhancement, not assumed here.
 * - `DTSTART`/`DTEND` are read as plain `YYYYMMDD` (all-day) or
 *   `YYYYMMDDTHHMMSS[Z]` values; `TZID` parameters are ignored and the
 *   date portion is taken as-is — correct for the all-day-event shape
 *   every OTA export actually uses for stays, not a general-purpose
 *   timezone-aware iCal engine.
 * - `DTEND` in iCal is exclusive (the day checkout happens), matching
 *   this platform's own accommodation semantics — the returned
 *   `dateTo` is `DTEND` minus one day so it means "last occupied night,"
 *   consistent with how `date_to` is used elsewhere in this codebase's
 *   date-range consumption.
 */

function unfold(icsText) {
  // RFC 5545 §3.1: a line starting with a space/tab continues the previous line.
  return icsText.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function parseIcsDate(raw) {
  const value = raw.split(':').pop().trim();
  const isAllDay = /^\d{8}$/.test(value);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { iso, isAllDay };
}

function addDays(isoDate, delta) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/**
 * @param {string} icsText raw .ics file content
 * @returns {Array<{uid:string, dateFrom:string, dateTo:string, summary:string, status:string}>}
 */
export function parseIcalEvents(icsText) {
  const unfolded = unfold(icsText);
  const eventBlocks = unfolded.split('BEGIN:VEVENT').slice(1);
  const events = [];

  for (const block of eventBlocks) {
    const body = block.split('END:VEVENT')[0];
    const lines = body
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const uidLine = lines.find((line) => line.startsWith('UID'));
    const startLine = lines.find((line) => line.startsWith('DTSTART'));
    const endLine = lines.find((line) => line.startsWith('DTEND'));
    const summaryLine = lines.find((line) => line.startsWith('SUMMARY'));
    const statusLine = lines.find((line) => line.startsWith('STATUS'));

    // Not a well-formed occupancy event — skip, don't crash the whole import.
    if (!uidLine || !startLine || !endLine) {
      // eslint-disable-next-line no-continue
      continue;
    }

    const uid = uidLine.split(':').slice(1).join(':').trim();
    const start = parseIcsDate(startLine);
    const end = parseIcsDate(endLine);
    // iCal DTEND is exclusive; this platform's date_to is the last
    // occupied night (see file header) — subtract one day for an
    // all-day event, keep as-is for a timed event (already exclusive of
    // the end instant, so its own date is the last occupied day).
    const dateTo =
      start.isAllDay && end.isAllDay ? addDays(end.iso, -1) : end.iso;

    events.push({
      uid,
      dateFrom: start.iso,
      dateTo: dateTo >= start.iso ? dateTo : start.iso,
      summary: summaryLine
        ? summaryLine.split(':').slice(1).join(':').trim()
        : null,
      status: statusLine
        ? statusLine.split(':').slice(1).join(':').trim()
        : 'CONFIRMED',
    });
  }

  return events;
}

export default parseIcalEvents;
