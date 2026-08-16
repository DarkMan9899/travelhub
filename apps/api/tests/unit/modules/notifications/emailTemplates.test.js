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
});
