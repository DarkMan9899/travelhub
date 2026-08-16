/**
 * Notifications module route wiring (BACKEND_ARCHITECTURE.md §2: route
 * wiring only, no logic). Every route is `requireAuth` — a notification
 * is always scoped to its own recipient (ownership check in the
 * Service, no permission-key RBAC needed) — except the announcement
 * endpoint, which is `requireRole(['ADMIN','SUPER_ADMIN'])`.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import { requireRole } from '../../guards/requireRole.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  preferenceCategoryParamsSchema,
  createAnnouncementSchema,
} from './validators/notificationValidators.js';

export default function createNotificationRoutes({
  notificationController,
  guards,
}) {
  const router = Router();
  const { requireAuth } = guards;

  router.get(
    '/',
    requireAuth,
    validate(listNotificationsQuerySchema),
    notificationController.list,
  );

  router.get('/unread-count', requireAuth, notificationController.unreadCount);

  router.get(
    '/preferences',
    requireAuth,
    notificationController.listPreferences,
  );

  router.patch(
    '/preferences/:category',
    requireAuth,
    validate(preferenceCategoryParamsSchema),
    notificationController.updatePreference,
  );

  router.post('/read-all', requireAuth, notificationController.markAllRead);

  router.post(
    '/announcements',
    requireAuth,
    requireRole('ADMIN', 'SUPER_ADMIN'),
    validate(createAnnouncementSchema),
    notificationController.createAnnouncement,
  );

  router.patch(
    '/:id/read',
    requireAuth,
    validate(notificationIdParamsSchema),
    notificationController.markRead,
  );

  router.patch(
    '/:id/archive',
    requireAuth,
    validate(notificationIdParamsSchema),
    notificationController.archive,
  );

  router.delete(
    '/:id',
    requireAuth,
    validate(notificationIdParamsSchema),
    notificationController.remove,
  );

  return router;
}
