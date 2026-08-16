import { describe, test, expect } from 'vitest';
import { parseCsv } from './csvParser.js';

describe('parseCsv', () => {
  test('parses a simple header + rows CSV', () => {
    const text =
      'dateFrom,dateTo,quantity\n2026-01-10,2026-01-12,2\n2026-02-01,2026-02-02,1';
    const { headers, rows } = parseCsv(text);
    expect(headers).toEqual(['dateFrom', 'dateTo', 'quantity']);
    expect(rows).toEqual([
      { dateFrom: '2026-01-10', dateTo: '2026-01-12', quantity: '2' },
      { dateFrom: '2026-02-01', dateTo: '2026-02-02', quantity: '1' },
    ]);
  });

  test('handles quoted fields containing commas', () => {
    const text =
      'dateFrom,dateTo,guestName\n2026-01-10,2026-01-12,"Smith, John"';
    const { rows } = parseCsv(text);
    expect(rows).toEqual([
      {
        dateFrom: '2026-01-10',
        dateTo: '2026-01-12',
        guestName: 'Smith, John',
      },
    ]);
  });

  test('handles escaped double quotes inside a quoted field', () => {
    const text = 'notes\n"He said ""hello"""';
    const { rows } = parseCsv(text);
    expect(rows).toEqual([{ notes: 'He said "hello"' }]);
  });

  test('ignores blank lines', () => {
    const text =
      'dateFrom,dateTo\n2026-01-10,2026-01-12\n\n2026-02-01,2026-02-02\n';
    const { rows } = parseCsv(text);
    expect(rows).toHaveLength(2);
  });

  test('returns empty headers/rows for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  test('fills missing trailing cells with empty strings', () => {
    const text = 'dateFrom,dateTo,notes\n2026-01-10,2026-01-12';
    const { rows } = parseCsv(text);
    expect(rows).toEqual([
      { dateFrom: '2026-01-10', dateTo: '2026-01-12', notes: '' },
    ]);
  });
});
