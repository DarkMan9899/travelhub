/**
 * Notifications module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `userService` as an injected dependency (announcement audience
 * resolution, delivery recipient lookup) — never a second Repository
 * over `users`, the same cross-module rule every other module in this
 * codebase follows.
 *
 * `emailAdapter` defaults to `createEmailAdapter()` — P0.3 (Master
 * Roadmap): selects `ResendEmailProvider` when
 * `config.email.provider === 'resend'`, `ConsoleEmailProvider`
 * otherwise. A caller can still override it directly (tests do).
 */

import { MySqlNotificationRepository } from './repositories/mysqlNotificationRepository.js';
import { MySqlNotificationPreferenceRepository } from './repositories/mysqlNotificationPreferenceRepository.js';
import { MySqlEmailDeliveryRepository } from './repositories/mysqlEmailDeliveryRepository.js';
import { NotificationService } from './services/notificationService.js';
import { NotificationPreferenceService } from './services/notificationPreferenceService.js';
import { NotificationDeliveryService } from './services/notificationDeliveryService.js';
import { ConsoleEmailProvider } from './channels/consoleEmailProvider.js';
import { ResendEmailProvider } from './channels/resendEmailProvider.js';
import { createNotificationDeliveryQueue } from './jobs/notificationDeliveryQueue.js';
import { createNotificationController } from './controllers/notificationController.js';
import config from '../../config/index.js';

// P1.4 (Master Roadmap) — exported so `partnersContainer` can send a
// staff-invitation email directly (no `recipientUserId` exists yet for
// an invitee who may not have an account), reusing the exact same
// provider-selection logic rather than a second copy of it.
export function createEmailAdapter() {
  if (config.email.provider === 'resend') {
    return new ResendEmailProvider(config.email.resend);
  }
  return new ConsoleEmailProvider();
}

export default function createNotificationsContainer({
  userService,
  auditLogger,
  emailAdapter = createEmailAdapter(),
}) {
  const notificationRepository = new MySqlNotificationRepository();
  const preferenceRepository = new MySqlNotificationPreferenceRepository();
  const emailDeliveryRepository = new MySqlEmailDeliveryRepository();

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
    emailDeliveryRepository,
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
    emailDeliveryRepository,
    notificationService,
    notificationPreferenceService,
    notificationDeliveryService,
    notificationDeliveryQueue,
    notificationController,
  };
}
