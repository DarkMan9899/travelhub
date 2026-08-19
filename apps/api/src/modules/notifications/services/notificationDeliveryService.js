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
import { findLanguageCodeById } from '../../../infrastructure/database/repositories/languageRepository.js';

export class NotificationDeliveryService {
  #notificationRepository;

  #preferenceService;

  #userService;

  #emailAdapter;

  #enqueueDelivery;

  #emailDeliveryRepository;

  #resolveLanguageCode;

  constructor({
    notificationRepository,
    preferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
    emailDeliveryRepository,
    // Injectable so unit tests never need a real database — mirrors this
    // codebase's own `fetchImpl = fetch` precedent (icalConnector.js,
    // stripePaymentProvider.js) for swapping a low-level dependency.
    resolveLanguageCode = findLanguageCodeById,
  }) {
    this.#notificationRepository = notificationRepository;
    this.#preferenceService = preferenceService;
    this.#userService = userService;
    this.#emailAdapter = emailAdapter;
    this.#enqueueDelivery = enqueueDelivery;
    this.#emailDeliveryRepository = emailDeliveryRepository;
    this.#resolveLanguageCode = resolveLanguageCode;
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
      // P0.3 (Master Roadmap): the recipient's own preferred language,
      // falling back to the server default — never a lookup failure
      // blocking a real send.
      const locale = await this.#resolveLanguageCode(
        recipient.preferredLanguageId,
      );
      const email = renderEmail(
        notification.eventType,
        notification.payload,
        locale,
      );
      const result = await this.#emailAdapter.send(email, recipient.email);
      // P0.3: persist enough delivery metadata to answer "did this
      // actually send?" after the fact — previously nothing recorded
      // this anywhere; the result was only ever returned to the BullMQ
      // worker's own caller.
      if (this.#emailDeliveryRepository) {
        await this.#emailDeliveryRepository.create({
          notificationId,
          recipientEmail: recipient.email,
          provider: result.provider,
          status: result.delivered ? 'SENT' : 'FAILED',
          errorMessage: result.error ?? null,
        });
      }
      return result;
    }

    return null;
  }
}

export default NotificationDeliveryService;
