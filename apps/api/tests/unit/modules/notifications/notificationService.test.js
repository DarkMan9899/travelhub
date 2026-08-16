import { describe, test, expect, jest } from '@jest/globals';
import { NotificationService } from '../../../../src/modules/notifications/services/notificationService.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../../src/errors/AppError.js';

const CUSTOMER = { userId: 1, roles: ['CUSTOMER'] };
const ADMIN = { userId: 9, roles: ['ADMIN'] };

function buildService(overrides = {}) {
  const notificationRepository = {
    create: jest.fn().mockResolvedValue({ id: 100 }),
    listForUser: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    countUnread: jest.fn().mockResolvedValue(0),
    findById: jest.fn().mockResolvedValue({ id: 1, recipientUserId: 1 }),
    markRead: jest.fn().mockResolvedValue({ id: 1, isRead: true }),
    markAllRead: jest.fn().mockResolvedValue(undefined),
    archive: jest.fn().mockResolvedValue({ id: 1, isArchived: true }),
    softDelete: jest.fn().mockResolvedValue(true),
    ...overrides.notificationRepository,
  };
  const userService = {
    listAllUserIds: jest.fn().mockResolvedValue([1, 2, 3]),
    listUserIdsByRole: jest.fn().mockResolvedValue([9]),
    ...overrides.userService,
  };
  const auditLogger = { record: jest.fn().mockResolvedValue(undefined) };
  const deliveryService = { dispatch: jest.fn().mockResolvedValue(undefined) };
  const service = new NotificationService({
    notificationRepository,
    userService,
    auditLogger,
    deliveryService,
  });
  return {
    service,
    notificationRepository,
    userService,
    auditLogger,
    deliveryService,
  };
}

describe('NotificationService', () => {
  test('createNotification delegates to the repository then dispatches delivery', async () => {
    const { service, notificationRepository, deliveryService } = buildService();
    await service.createNotification({
      recipientUserId: 1,
      eventId: 'evt-1',
      eventType: 'booking.created',
      categoryCode: 'BOOKING',
      priorityCode: 'NORMAL',
      resourceType: 'booking',
      resourceId: 5,
      payload: { bookingReference: 'BK-1' },
    });
    expect(notificationRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 1,
        eventId: 'evt-1',
        eventType: 'booking.created',
        categoryCode: 'BOOKING',
        priorityCode: 'NORMAL',
      }),
    );
    expect(deliveryService.dispatch).toHaveBeenCalledWith({ id: 100 });
  });

  test('listForUser throws AuthenticationError with no principal', async () => {
    const { service } = buildService();
    await expect(service.listForUser(null)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  test('listForUser rejects an invalid status filter', async () => {
    const { service } = buildService();
    await expect(
      service.listForUser(CUSTOMER, { status: 'bogus' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('listForUser defaults to status "all" and scopes by the principal', async () => {
    const { service, notificationRepository } = buildService();
    await service.listForUser(CUSTOMER, { limit: 10 });
    expect(notificationRepository.listForUser).toHaveBeenCalledWith(1, {
      status: 'all',
      limit: 10,
    });
  });

  test('markAsRead throws NotFoundError when the notification is not owned by the principal', async () => {
    const { service } = buildService({
      notificationRepository: { findById: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.markAsRead(CUSTOMER, 999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test('markAsRead delegates to the repository when owned', async () => {
    const { service, notificationRepository } = buildService();
    await service.markAsRead(CUSTOMER, 1);
    expect(notificationRepository.markRead).toHaveBeenCalledWith(1, 1);
  });

  test('archive throws NotFoundError when not owned', async () => {
    const { service } = buildService({
      notificationRepository: { findById: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.archive(CUSTOMER, 999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test('softDelete throws NotFoundError when the repository reports no row affected', async () => {
    const { service } = buildService({
      notificationRepository: {
        softDelete: jest.fn().mockResolvedValue(false),
      },
    });
    await expect(service.softDelete(CUSTOMER, 999)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  test('createAnnouncement rejects a non-admin principal', async () => {
    const { service } = buildService();
    await expect(
      service.createAnnouncement(CUSTOMER, {
        audience: { type: 'ALL' },
        payload: { title: 'Hi' },
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  test('createAnnouncement fans out to every user for an ALL audience, dispatching delivery for each', async () => {
    const { service, notificationRepository, userService, deliveryService } =
      buildService();
    const result = await service.createAnnouncement(ADMIN, {
      audience: { type: 'ALL' },
      payload: { title: 'Maintenance window' },
    });
    expect(userService.listAllUserIds).toHaveBeenCalled();
    expect(notificationRepository.create).toHaveBeenCalledTimes(3);
    expect(deliveryService.dispatch).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(3);
  });

  test('createAnnouncement fans out only to the given roles for a ROLE audience', async () => {
    const { service, notificationRepository, userService } = buildService();
    await service.createAnnouncement(ADMIN, {
      audience: { type: 'ROLE', roles: ['ADMIN', 'SUPPORT'] },
      payload: { title: 'New escalation process' },
    });
    expect(userService.listUserIdsByRole).toHaveBeenCalledWith([
      'ADMIN',
      'SUPPORT',
    ]);
    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
  });

  test('createAnnouncement records an audit log entry', async () => {
    const { service, auditLogger } = buildService();
    await service.createAnnouncement(ADMIN, {
      audience: { type: 'ALL' },
      payload: { title: 'Hi' },
    });
    expect(auditLogger.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 9,
        action: 'notification.announcement_created',
        targetType: 'notification',
      }),
    );
  });
});
