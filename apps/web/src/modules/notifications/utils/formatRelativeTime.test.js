import { describe, test, expect, vi, afterEach } from 'vitest';
import { formatRelativeTime } from './formatRelativeTime.js';

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('formats a timestamp a few minutes in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:30:00.000Z'));
    const result = formatRelativeTime('2026-01-01T12:25:00.000Z', 'en');
    expect(result).toBe('5 minutes ago');
  });

  test('formats a timestamp a couple of days in the past', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-10T00:00:00.000Z'));
    const result = formatRelativeTime('2026-01-08T00:00:00.000Z', 'en');
    expect(result).toBe('2 days ago');
  });

  test('falls back to seconds for a just-now timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T12:00:10.000Z'));
    const result = formatRelativeTime('2026-01-01T12:00:00.000Z', 'en');
    expect(result).toMatch(/second/);
  });
});
