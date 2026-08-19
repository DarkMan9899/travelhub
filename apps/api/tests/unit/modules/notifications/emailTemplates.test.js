import { describe, test, expect } from '@jest/globals';
import { renderEmail } from '../../../../src/modules/notifications/channels/emailTemplates.js';

describe('renderEmail', () => {
  test('renders a known event type with interpolated payload fields', () => {
    const { subject, body } = renderEmail('booking.confirmed', {
      bookingReference: 'BK-42',
    });
    expect(subject).toBe('Booking confirmed');
    expect(body).toContain('BK-42');
  });

  test('renders admin.announcement using the payload title/body directly', () => {
    const { subject, body } = renderEmail('admin.announcement', {
      title: 'Scheduled maintenance',
      body: 'Tonight at 2am.',
    });
    expect(subject).toBe('Scheduled maintenance');
    expect(body).toBe('Tonight at 2am.');
  });

  test('falls back to a generic rendering for an unknown event type', () => {
    const { subject, body } = renderEmail('payment.refunded', { amount: 10 });
    expect(subject).toBe('Notification');
    expect(body).toContain('payment.refunded');
  });

  test('(P0.3) renders a known event type in hy when locale is "hy"', () => {
    const { subject, body } = renderEmail(
      'booking.confirmed',
      { bookingReference: 'BK-42' },
      'hy',
    );
    expect(subject).toBe('Ամրագրումը հաստատվել է');
    expect(body).toContain('BK-42');
  });

  test('(P0.3) renders a known event type in ru when locale is "ru"', () => {
    const { subject, body } = renderEmail(
      'booking.confirmed',
      { bookingReference: 'BK-42' },
      'ru',
    );
    expect(subject).toBe('Бронирование подтверждено');
    expect(body).toContain('BK-42');
  });

  test('(P0.3) falls back to en for a locale with no translation for a given event', () => {
    const { subject } = renderEmail(
      'booking.confirmed',
      { bookingReference: 'BK-42' },
      'fr',
    );
    expect(subject).toBe('Booking confirmed');
  });
});
