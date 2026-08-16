import { describe, test, expect, jest } from '@jest/globals';
import { NotificationDeliveryService } from '../../../../src/modules/notifications/services/notificationDeliveryService.js';

const NOTIFICATION = {
  id: 1,
  recipientUserId: 5,
  eventType: 'booking.confirmed',
  categoryCode: 'BOOKING',
  payload: { bookingReference: 'BK-9' },
};

function buildService(overrides = {}) {
  const notificationRepository = {
    findByIdUnscoped: jest.fn().mockResolvedValue(NOTIFICATION),
    ...overrides.notificationRepository,
  };
  const preferenceService = {
    isChannelEnabled: jest.fn().mockResolvedValue(true),
    ...overrides.preferenceService,
  };
  const userService = {
    findById: jest
      .fn()
      .mockResolvedValue({ id: 5, email: 'traveler@example.com' }),
    ...overrides.userService,
  };
  const emailAdapter = {
    send: jest.fn().mockResolvedValue({ delivered: true, provider: 'console' }),
    ...overrides.emailAdapter,
  };
  const enqueueDelivery = jest.fn().mockResolvedValue(undefined);
  const service = new NotificationDeliveryService({
    notificationRepository,
    preferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
  });
  return {
    service,
    notificationRepository,
    preferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
  };
}

describe('NotificationDeliveryService', () => {
  test('dispatch enqueues an EMAIL delivery job when the category has email enabled', async () => {
    const { service, preferenceService, enqueueDelivery } = buildService();
    await service.dispatch(NOTIFICATION);
    expect(preferenceService.isChannelEnabled).toHaveBeenCalledWith(
      5,
      'BOOKING',
      'EMAIL',
    );
    expect(enqueueDelivery).toHaveBeenCalledWith({
      notificationId: 1,
      channel: 'EMAIL',
    });
  });

  test('dispatch does not enqueue anything when email is disabled for the category', async () => {
    const { service, enqueueDelivery } = buildService({
      preferenceService: {
        isChannelEnabled: jest.fn().mockResolvedValue(false),
      },
    });
    await service.dispatch(NOTIFICATION);
    expect(enqueueDelivery).not.toHaveBeenCalled();
  });

  test('deliverViaChannel renders the template and sends via the email adapter', async () => {
    const { service, emailAdapter, userService } = buildService();
    const result = await service.deliverViaChannel(1, 'EMAIL');
    expect(userService.findById).toHaveBeenCalledWith(5);
    expect(emailAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.any(String),
        body: expect.any(String),
      }),
      'traveler@example.com',
    );
    expect(result).toEqual({ delivered: true, provider: 'console' });
  });

  test('deliverViaChannel is a safe no-op when the notification no longer exists', async () => {
    const { service, emailAdapter } = buildService({
      notificationRepository: {
        findByIdUnscoped: jest.fn().mockResolvedValue(null),
      },
    });
    const result = await service.deliverViaChannel(999, 'EMAIL');
    expect(result).toBeNull();
    expect(emailAdapter.send).not.toHaveBeenCalled();
  });

  test('deliverViaChannel is a safe no-op when the recipient no longer exists', async () => {
    const { service, emailAdapter } = buildService({
      userService: { findById: jest.fn().mockResolvedValue(null) },
    });
    const result = await service.deliverViaChannel(1, 'EMAIL');
    expect(result).toBeNull();
    expect(emailAdapter.send).not.toHaveBeenCalled();
  });

  test('deliverViaChannel returns null for an unrecognized channel', async () => {
    const { service, emailAdapter } = buildService();
    const result = await service.deliverViaChannel(1, 'SMS');
    expect(result).toBeNull();
    expect(emailAdapter.send).not.toHaveBeenCalled();
  });
});
