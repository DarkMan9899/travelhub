/**
 * Notifications module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `userService` as an injected dependency (announcement audience
 * resolution, delivery recipient lookup) — never a second Repository
 * over `users`, the same cross-module rule every other module in this
 * codebase follows.
 *
 * The default `emailAdapter` (`ConsoleEmailProvider`) is the one line a
 * real provider (SendGrid/Resend/SES/SMTP) replaces later — nothing else
 * in this module changes.
 */

import { MySqlNotificationRepository } from './repositories/mysqlNotificationRepository.js';
import { MySqlNotificationPreferenceRepository } from './repositories/mysqlNotificationPreferenceRepository.js';
import { NotificationService } from './services/notificationService.js';
import { NotificationPreferenceService } from './services/notificationPreferenceService.js';
import { NotificationDeliveryService } from './services/notificationDeliveryService.js';
import { ConsoleEmailProvider } from './channels/consoleEmailProvider.js';
import { createNotificationDeliveryQueue } from './jobs/notificationDeliveryQueue.js';
import { createNotificationController } from './controllers/notificationController.js';

export default function createNotificationsContainer({
  userService,
  auditLogger,
  emailAdapter = new ConsoleEmailProvider(),
}) {
  const notificationRepository = new MySqlNotificationRepository();
  const preferenceRepository = new MySqlNotificationPreferenceRepository();

  const notificationPreferenceService = new NotificationPreferenceService({
    preferenceRepository,
  });

  const { queue: notificationDeliveryQueue, enqueueDelivery } =
    createNotificationDeliveryQueue();
  const notificationDeliveryService = new NotificationDeliveryService({
    notificationRepository,
    preferenceService: notificationPreferenceService,
    userService,
    emailAdapter,
    enqueueDelivery,
  });

  const notificationService = new NotificationService({
    notificationRepository,
    userService,
    auditLogger,
    deliveryService: notificationDeliveryService,
    preferenceService: notificationPreferenceService,
  });

  const notificationController = createNotificationController(
    notificationService,
    notificationPreferenceService,
  );

  return {
    notificationRepository,
    preferenceRepository,
    notificationService,
    notificationPreferenceService,
    notificationDeliveryService,
    notificationDeliveryQueue,
    notificationController,
  };
}
