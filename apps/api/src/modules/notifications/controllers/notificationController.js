/**
 * Notifications module Controller (BACKEND_ARCHITECTURE.md Ch.5): parse
 * input -> call Service -> shape response. No business logic.
 */

import {
  toNotificationResponse,
  toPreferenceResponse,
  toUnreadCountResponse,
} from '../dto/notificationDto.js';

export function createNotificationController(
  notificationService,
  notificationPreferenceService,
) {
  return {
    async list(req, res, next) {
      try {
        const { status, category, search, cursor, limit } = req.validated.query;
        const { rows, meta } = await notificationService.listForUser(
          req.principal,
          {
            status,
            categoryCode: category,
            search,
            cursor,
            limit: limit ?? 20,
          },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toNotificationResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async unreadCount(req, res, next) {
      try {
        const count = await notificationService.getUnreadCount(req.principal);
        res.status(200).json({
          success: true,
          data: toUnreadCountResponse(count),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async markRead(req, res, next) {
      try {
        const notification = await notificationService.markAsRead(
          req.principal,
          req.validated.params.id,
        );
        res.status(200).json({
          success: true,
          data: toNotificationResponse(notification),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async markAllRead(req, res, next) {
      try {
        await notificationService.markAllAsRead(req.principal);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async archive(req, res, next) {
      try {
        const notification = await notificationService.archive(
          req.principal,
          req.validated.params.id,
        );
        res.status(200).json({
          success: true,
          data: toNotificationResponse(notification),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        await notificationService.softDelete(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async listPreferences(req, res, next) {
      try {
        const preferences = await notificationPreferenceService.getPreferences(
          req.principal.userId,
        );
        res.status(200).json({
          success: true,
          data: preferences.map(toPreferenceResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updatePreference(req, res, next) {
      try {
        const preference = await notificationPreferenceService.updatePreference(
          req.principal.userId,
          req.validated.params.category,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toPreferenceResponse(preference),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async createAnnouncement(req, res, next) {
      try {
        const notifications = await notificationService.createAnnouncement(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: { recipient_count: notifications.length },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createNotificationController;
