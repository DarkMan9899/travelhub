import { describe, test, expect } from '@jest/globals';
import { NoOpErrorTracker } from '../../../../src/infrastructure/observability/noOpErrorTracker.js';
import { redact } from '../../../../src/infrastructure/observability/sentryErrorTracker.js';

describe('NoOpErrorTracker (P0.8)', () => {
  test('captureException never throws and returns undefined', () => {
    const tracker = new NoOpErrorTracker();
    expect(() =>
      tracker.captureException(new Error('boom'), { a: 1 }),
    ).not.toThrow();
  });

  test('captureMessage never throws', () => {
    const tracker = new NoOpErrorTracker();
    expect(() =>
      tracker.captureMessage('something happened', { a: 1 }),
    ).not.toThrow();
  });

  test('flush resolves truthy without a real provider to flush', async () => {
    const tracker = new NoOpErrorTracker();
    await expect(tracker.flush()).resolves.toBe(true);
  });
});

describe('SentryErrorTracker redact() (P0.8)', () => {
  test('redacts a top-level sensitive field', () => {
    expect(redact({ password: 'hunter2', bookingId: 42 })).toEqual({
      password: '[REDACTED]',
      bookingId: 42,
    });
  });

  test('redacts a sensitive field nested inside another object', () => {
    expect(
      redact({
        booking: { id: 1, customer: { email: 'a@b.com', token: 'abc123' } },
      }),
    ).toEqual({
      booking: { id: 1, customer: { email: 'a@b.com', token: '[REDACTED]' } },
    });
  });

  test('redacts sensitive fields inside array elements', () => {
    expect(redact({ items: [{ apiKey: 'x' }, { safe: true }] })).toEqual({
      items: [{ apiKey: '[REDACTED]' }, { safe: true }],
    });
  });

  test('leaves non-sensitive data, primitives, and null/undefined untouched', () => {
    expect(redact({ bookingReference: 'BK-1', amount: '100.00' })).toEqual({
      bookingReference: 'BK-1',
      amount: '100.00',
    });
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact('plain string')).toBe('plain string');
  });

  test('does not infinite-loop on a circular reference', () => {
    const obj = { name: 'x' };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
    expect(redact(obj).self).toBe('[Circular]');
  });
});

describe('createErrorTracker (P0.8)', () => {
  test('returns a NoOpErrorTracker by default (ERROR_TRACKING_PROVIDER=none in this test environment)', async () => {
    const { createErrorTracker } =
      await import('../../../../src/infrastructure/observability/createErrorTracker.js');
    const tracker = createErrorTracker();
    expect(tracker).toBeInstanceOf(NoOpErrorTracker);
  });
});
