import { describe, test, expect, jest } from '@jest/globals';
import { ResendEmailProvider } from '../../../../src/modules/notifications/channels/resendEmailProvider.js';

describe('ResendEmailProvider (P0.3)', () => {
  test('isConfigured is false without an apiKey/fromAddress', () => {
    const unconfigured = new ResendEmailProvider({});
    expect(unconfigured.isConfigured).toBe(false);

    const configured = new ResendEmailProvider({
      apiKey: 're_test_x',
      fromAddress: 'no-reply@desavii.com',
    });
    expect(configured.isConfigured).toBe(true);
  });

  test('send() returns a clear, non-throwing failure result when unconfigured — never blocks the caller', async () => {
    const provider = new ResendEmailProvider({});
    const result = await provider.send(
      { subject: 'Hi', body: 'Body' },
      'traveler@example.com',
    );
    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('resend');
    expect(result.error).toMatch(/not configured/i);
  });

  test('send() posts the right payload and reports success on a 2xx response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'email_123' }),
    });
    const provider = new ResendEmailProvider({
      apiKey: 're_test_x',
      fromAddress: 'no-reply@desavii.com',
      fetchImpl,
    });

    const result = await provider.send(
      { subject: 'Booking confirmed', body: 'Your booking BK-1 is confirmed.' },
      'traveler@example.com',
    );

    expect(result).toEqual({ delivered: true, provider: 'resend' });
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(options.headers.Authorization).toBe('Bearer re_test_x');
    expect(JSON.parse(options.body)).toEqual({
      from: 'no-reply@desavii.com',
      to: ['traveler@example.com'],
      subject: 'Booking confirmed',
      text: 'Your booking BK-1 is confirmed.',
    });
  });

  test('send() reports a non-throwing failure on a non-OK response, never leaking a raw exception', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: 'Invalid `to` field.' }),
    });
    const provider = new ResendEmailProvider({
      apiKey: 're_test_x',
      fromAddress: 'no-reply@desavii.com',
      fetchImpl,
    });

    const result = await provider.send(
      { subject: 'Hi', body: 'Body' },
      'not-an-email',
    );
    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('resend');
    expect(result.error).toBe('Invalid `to` field.');
  });

  test('send() reports a non-throwing failure when the network call itself fails', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new ResendEmailProvider({
      apiKey: 're_test_x',
      fromAddress: 'no-reply@desavii.com',
      fetchImpl,
    });

    const result = await provider.send(
      { subject: 'Hi', body: 'Body' },
      'traveler@example.com',
    );
    expect(result.delivered).toBe(false);
    expect(result.provider).toBe('resend');
  });
});
