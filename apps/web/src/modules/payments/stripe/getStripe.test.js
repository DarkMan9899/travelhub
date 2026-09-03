import { describe, test, expect, vi, beforeEach } from 'vitest';
import { loadStripe } from '@stripe/stripe-js/pure';

vi.mock('@stripe/stripe-js/pure', () => ({
  loadStripe: vi.fn(() => Promise.resolve({ mocked: true })),
}));

describe('getStripe (apps/web/src/modules/payments)', () => {
  beforeEach(() => {
    loadStripe.mockClear();
    vi.resetModules();
  });

  test('go-live sequencing: never calls loadStripe (never initializes Stripe.js) without a publishable key', async () => {
    const { getStripe } = await import('./getStripe.js');
    expect(getStripe(null)).toBeNull();
    expect(getStripe(undefined)).toBeNull();
    expect(getStripe('')).toBeNull();
    expect(loadStripe).not.toHaveBeenCalled();
  });

  test('calls loadStripe exactly once for repeated calls with the same key (memoized)', async () => {
    const { getStripe } = await import('./getStripe.js');
    const first = getStripe('pk_test_abc');
    const second = getStripe('pk_test_abc');
    expect(first).toBe(second);
    expect(loadStripe).toHaveBeenCalledTimes(1);
    expect(loadStripe).toHaveBeenCalledWith('pk_test_abc');
  });

  test('reloads Stripe.js if the publishable key actually changes', async () => {
    const { getStripe } = await import('./getStripe.js');
    getStripe('pk_test_abc');
    getStripe('pk_test_xyz');
    expect(loadStripe).toHaveBeenCalledTimes(2);
    expect(loadStripe).toHaveBeenNthCalledWith(2, 'pk_test_xyz');
  });
});
