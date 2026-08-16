/**
 * NotificationDeliveryService — Phase 13.
 *
 * The one place that knows a notification might go out over more than
 * one channel. In-app is already satisfied by the row `NotificationService`
 * just wrote — nothing further to do for it. Email is dispatched
 * asynchronously via the injected `enqueueDelivery` (the
 * `notifications.delivery` BullMQ queue, see `jobs/
 * notificationDeliveryQueue.js`) so a slow/unreliable email send can
 * never block the HTTP request that triggered the underlying event.
 *
 * `deliverViaChannel` is the plain, directly-callable, framework-free
 * function the queue's Worker (and integration tests) invoke — mirrors
 * `booking-holds/jobs/holdExpirySweep.js`'s `sweepExpiredHolds` split
 * between "plain function" and "BullMQ wrapper".
 */

import { renderEmail } from '../channels/emailTemplates.js';

export class NotificationDeliveryService {
  #notificationRepository;

  #preferenceService;

  #userService;

  #emailAdapter;

  #enqueueDelivery;

  constructor({
    notificationRepository,
    preferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
  }) {
    this.#notificationRepository = notificationRepository;
    this.#preferenceService = preferenceService;
    this.#userService = userService;
    this.#emailAdapter = emailAdapter;
    this.#enqueueDelivery = enqueueDelivery;
  }

  /** Called right after `NotificationService.createNotification` writes the in-app row. */
  async dispatch(notification) {
    const emailEnabled = await this.#preferenceService.isChannelEnabled(
      notification.recipientUserId,
      notification.categoryCode,
      'EMAIL',
    );
    if (emailEnabled) {
      await this.#enqueueDelivery({
        notificationId: notification.id,
        channel: 'EMAIL',
      });
    }
  }

  /** Invoked by the BullMQ Worker (or directly by tests) — never by an HTTP route. */
  async deliverViaChannel(notificationId, channel) {
    const notification =
      await this.#notificationRepository.findByIdUnscoped(notificationId);
    if (!notification) return null;

    if (channel === 'EMAIL') {
      const recipient = await this.#userService.findById(
        notification.recipientUserId,
      );
      if (!recipient) return null;
      const email = renderEmail(notification.eventType, notification.payload);
      return this.#emailAdapter.send(email, recipient.email);
    }

    return null;
  }
}

export default NotificationDeliveryService;
