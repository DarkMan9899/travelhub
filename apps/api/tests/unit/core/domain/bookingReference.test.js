/**
 * Sprint 10: `bookings.booking_reference` generator — must fit the
 * column's `VARCHAR(30)`, stay collision-resistant enough that the
 * repository's retry-on-duplicate loop rarely fires, and avoid characters
 * a support agent could misread over the phone (`0`/`O`, `1`/`I`/`L`).
 */

import { describe, test, expect } from '@jest/globals';
import { generateBookingReference } from '../../../../src/core/domain/bookingReference.js';

describe('generateBookingReference', () => {
  test('fits within the booking_reference column width (VARCHAR(30))', () => {
    const reference = generateBookingReference();
    expect(reference.length).toBeLessThanOrEqual(30);
  });

  test('embeds the UTC calendar date', () => {
    const reference = generateBookingReference(
      new Date('2026-07-20T23:30:00Z'),
    );
    expect(reference).toContain('20260720');
  });

  test('the random segment never contains visually-ambiguous characters', () => {
    // The date segment legitimately contains digits like 0/1 (calendar
    // dates use the full 0-9 range) — only the trailing random segment is
    // drawn from the restricted, ambiguity-free alphabet.
    const reference = generateBookingReference();
    const randomSegment = reference.split('-')[2];
    expect(randomSegment).not.toMatch(/[0O1IL]/);
  });

  test('generates distinct values across repeated calls', () => {
    const references = new Set(
      Array.from({ length: 50 }, () => generateBookingReference()),
    );
    expect(references.size).toBe(50);
  });

  test('matches the expected BK-<date>-<random> shape', () => {
    const reference = generateBookingReference(
      new Date('2026-01-05T00:00:00Z'),
    );
    expect(reference).toMatch(/^BK-20260105-[A-Z2-9]{8}$/);
  });
});
