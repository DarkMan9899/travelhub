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
  const emailDeliveryRepository = {
    create: jest.fn().mockResolvedValue(undefined),
    ...overrides.emailDeliveryRepository,
  };
  const resolveLanguageCode =
    overrides.resolveLanguageCode ?? jest.fn().mockResolvedValue('en');
  const service = new NotificationDeliveryService({
    notificationRepository,
    preferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
    emailDeliveryRepository,
    resolveLanguageCode,
  });
  return {
    service,
    notificationRepository,
    preferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
    emailDeliveryRepository,
    resolveLanguageCode,
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

  test('(P0.3) deliverViaChannel resolves the recipient locale and renders the template in it', async () => {
    const { service, resolveLanguageCode, emailAdapter } = buildService({
      userService: {
        findById: jest.fn().mockResolvedValue({
          id: 5,
          email: 'traveler@example.com',
          preferredLanguageId: 3,
        }),
      },
      resolveLanguageCode: jest.fn().mockResolvedValue('hy'),
    });
    await service.deliverViaChannel(1, 'EMAIL');
    expect(resolveLanguageCode).toHaveBeenCalledWith(3);
    expect(emailAdapter.send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Ամրագրումը հաստատվել է' }),
      'traveler@example.com',
    );
  });

  test('(P0.3) deliverViaChannel persists a SENT delivery record on success', async () => {
    const { service, emailDeliveryRepository } = buildService();
    await service.deliverViaChannel(1, 'EMAIL');
    expect(emailDeliveryRepository.create).toHaveBeenCalledWith({
      notificationId: 1,
      recipientEmail: 'traveler@example.com',
      provider: 'console',
      status: 'SENT',
      errorMessage: null,
    });
  });

  test('(P0.3) deliverViaChannel persists a FAILED delivery record when the adapter reports failure', async () => {
    const { service, emailDeliveryRepository } = buildService({
      emailAdapter: {
        send: jest.fn().mockResolvedValue({
          delivered: false,
          provider: 'resend',
          error: 'Invalid recipient address',
        }),
      },
    });
    await service.deliverViaChannel(1, 'EMAIL');
    expect(emailDeliveryRepository.create).toHaveBeenCalledWith({
      notificationId: 1,
      recipientEmail: 'traveler@example.com',
      provider: 'resend',
      status: 'FAILED',
      errorMessage: 'Invalid recipient address',
    });
  });
});
