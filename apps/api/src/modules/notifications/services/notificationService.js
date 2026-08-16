/**
 * NotificationService — public Service for the Notifications module
 * (Phase 13). Depends on `userService`'s public interface only, to
 * resolve an announcement's recipient audience — never a second
 * Repository over `users` (the same cross-module rule `ReviewService`/
 * `FavoriteService` already established).
 *
 * `createNotification` is the one method `events/notificationListener.js`
 * calls after resolving a domain event's recipient — it never talks to
 * the repository directly, and it never blocks on channel delivery
 * (that's `NotificationDeliveryService`'s job, wired in Stage 13.3).
 */

import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
} from '../../../errors/AppError.js';

const VALID_STATUSES = new Set(['all', 'unread', 'archived']);

export class NotificationService {
  #notificationRepository;

  #userService;

  #auditLogger;

  #deliveryService;

  constructor({
    notificationRepository,
    userService,
    auditLogger,
    deliveryService,
  }) {
    this.#notificationRepository = notificationRepository;
    this.#userService = userService;
    this.#auditLogger = auditLogger;
    this.#deliveryService = deliveryService;
  }

  /**
   * Called by `notificationListener.js` — never by an HTTP route
   * directly. Writes the in-app row (always) then hands off to
   * `NotificationDeliveryService` for any other enabled channel — the
   * business event that triggered this has already finished/committed
   * by the time this runs, so a slow delivery dispatch can never block it.
   */
  async createNotification({
    recipientUserId,
    eventId = null,
    eventType,
    categoryCode,
    priorityCode = 'NORMAL',
    actorId = null,
    resourceType = null,
    resourceId = null,
    payload = {},
    metadata = {},
  }) {
    const notification = await this.#notificationRepository.create({
      recipientUserId,
      eventId,
      eventType,
      categoryCode,
      priorityCode,
      actorId,
      resourceType,
      resourceId,
      payload,
      metadata,
    });
    await this.#deliveryService.dispatch(notification);
    return notification;
  }

  async listForUser(principal, filters = {}) {
    if (!principal) throw new AuthenticationError();
    const status = filters.status ?? 'all';
    if (!VALID_STATUSES.has(status)) {
      throw new ValidationError('Invalid notification status filter.', [
        { field: 'status', issue: 'INVALID_STATUS' },
      ]);
    }
    return this.#notificationRepository.listForUser(principal.userId, {
      ...filters,
      status,
    });
  }

  async getUnreadCount(principal) {
    if (!principal) throw new AuthenticationError();
    return this.#notificationRepository.countUnread(principal.userId);
  }

  async markAsRead(principal, notificationId) {
    if (!principal) throw new AuthenticationError();
    const existing = await this.#notificationRepository.findById(
      notificationId,
      principal.userId,
    );
    if (!existing) throw new NotFoundError('Notification not found.');
    return this.#notificationRepository.markRead(
      notificationId,
      principal.userId,
    );
  }

  async markAllAsRead(principal) {
    if (!principal) throw new AuthenticationError();
    await this.#notificationRepository.markAllRead(principal.userId);
  }

  async archive(principal, notificationId) {
    if (!principal) throw new AuthenticationError();
    const existing = await this.#notificationRepository.findById(
      notificationId,
      principal.userId,
    );
    if (!existing) throw new NotFoundError('Notification not found.');
    return this.#notificationRepository.archive(
      notificationId,
      principal.userId,
    );
  }

  async softDelete(principal, notificationId) {
    if (!principal) throw new AuthenticationError();
    const deleted = await this.#notificationRepository.softDelete(
      notificationId,
      principal.userId,
    );
    if (!deleted) throw new NotFoundError('Notification not found.');
  }

  /**
   * Admin/super-admin only (enforced by the route's own `requireRole`
   * guard — this is the second, defense-in-depth check). `audience` is
   * either `{ type: 'ALL' }` or `{ type: 'ROLE', roles: string[] }` —
   * deliberately not "specific user ids": this is a broadcast tool, not
   * a targeted-messaging feature (that would be a future Messaging
   * module, out of scope here).
   */
  async createAnnouncement(
    principal,
    { audience, priorityCode = 'NORMAL', payload },
  ) {
    if (!principal) throw new AuthenticationError();
    if (
      !principal.roles?.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role))
    ) {
      throw new AuthorizationError(
        'Only administrators can create announcements.',
      );
    }

    const recipientUserIds =
      audience.type === 'ALL'
        ? await this.#userService.listAllUserIds()
        : await this.#userService.listUserIdsByRole(audience.roles);

    const notifications = await Promise.all(
      recipientUserIds.map((recipientUserId) =>
        // Reuses `createNotification` (not a direct repository call) so
        // an announcement gets the same delivery-dispatch step
        // (email, if the recipient has that category enabled) as every
        // event-sourced notification.
        this.createNotification({
          recipientUserId,
          eventId: null,
          eventType: 'admin.announcement',
          categoryCode: 'ADMIN',
          priorityCode,
          actorId: principal.userId,
          resourceType: null,
          resourceId: null,
          payload,
          metadata: { audience },
        }),
      ),
    );

    await this.#auditLogger.record({
      actorId: principal.userId,
      action: 'notification.announcement_created',
      // Anchored to the first resulting notification row (the closest
      // real entity — an announcement fans out into N per-recipient
      // rows, so there is no single "announcement" id of its own);
      // `afterSnapshot` carries the actual audience/count context.
      targetType: 'notification',
      targetId: notifications[0]?.id ?? 0,
      afterSnapshot: { audience, recipientCount: recipientUserIds.length },
    });

    return notifications;
  }
}

export default NotificationService;
