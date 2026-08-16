/**
 * Phase 17 §19 — the hand-rolled minimal iCal VEVENT parser. Fixture-only
 * (no network), per the module's own header comment on why a real
 * third-party feed is never live-called anywhere in this codebase.
 */

import { describe, test, expect } from '@jest/globals';
import { parseIcalEvents } from '../../../../src/modules/availability/connectors/icalParser.js';

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:abc-123@airbnb.com
DTSTART;VALUE=DATE:20260910
DTEND;VALUE=DATE:20260913
SUMMARY:Reserved
STATUS:CONFIRMED
END:VEVENT
BEGIN:VEVENT
UID:def-456@airbnb.com
DTSTART;VALUE=DATE:20260920
DTEND;VALUE=DATE:20260921
SUMMARY:Reserved
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`;

describe('parseIcalEvents', () => {
  test('parses a multi-day all-day event, converting the exclusive DTEND to an inclusive last-night dateTo', () => {
    const events = parseIcalEvents(SAMPLE_ICS);
    const stay = events.find((e) => e.uid === 'abc-123@airbnb.com');
    expect(stay).toMatchObject({
      dateFrom: '2026-09-10',
      dateTo: '2026-09-12', // DTEND 09-13 exclusive -> last occupied night 09-12
      status: 'CONFIRMED',
    });
  });

  test('preserves a CANCELLED status so the connector can release the corresponding capacity', () => {
    const events = parseIcalEvents(SAMPLE_ICS);
    const cancelled = events.find((e) => e.uid === 'def-456@airbnb.com');
    expect(cancelled.status).toBe('CANCELLED');
  });

  test('skips a malformed VEVENT block missing UID/DTSTART/DTEND instead of throwing', () => {
    const malformed = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:No UID or dates here
END:VEVENT
END:VCALENDAR`;
    expect(() => parseIcalEvents(malformed)).not.toThrow();
    expect(parseIcalEvents(malformed)).toEqual([]);
  });

  test('unfolds a line-folded (CRLF + leading-space continuation) property per RFC 5545', () => {
    const folded = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:folded-1@test.com\r\nDTSTART;VALUE=DATE:20260901\r\nDTEND;VALUE=DATE:20260902\r\nSUMMARY:A long\r\n summary that wraps\r\nEND:VEVENT\r\nEND:VCALENDAR`;
    const events = parseIcalEvents(folded);
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe('A longsummary that wraps');
  });

  test('returns an empty array for an empty/no-VEVENT calendar', () => {
    expect(parseIcalEvents('BEGIN:VCALENDAR\nEND:VCALENDAR')).toEqual([]);
  });
});
