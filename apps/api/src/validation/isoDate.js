/**
 * Shared `YYYY-MM-DD` Zod schema — structurally well-formed AND a real
 * calendar date (rejects e.g. `2026-02-30`). Originally Availability-
 * module-only (Sprint 9); Sprint 10's `booking-holds`/`bookings` modules
 * need the identical rule, so it moved here rather than being duplicated
 * per module (BACKEND_ARCHITECTURE.md §1's "never duplicate
 * functionality"). Crosscutting (`src/validation/*`), so any module's
 * validators may import it.
 */

import { z } from 'zod';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format.')
  .refine(
    (value) => {
      const parsed = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    },
    { message: 'Invalid calendar date.' },
  );

export default isoDateSchema;
