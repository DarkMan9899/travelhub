/**
 * Conversation Controller (BACKEND_ARCHITECTURE.md Ch.5): parse input ->
 * call Service -> shape response. No business logic.
 */

import {
  toConversationResponse,
  toUnreadConversationCountResponse,
} from '../dto/conversationDto.js';

export function createConversationController(conversationService) {
  return {
    async create(req, res, next) {
      try {
        const conversation = await conversationService.createConversation(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toConversationResponse(conversation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const { status, search, cursor, limit } = req.validated.query;
        const { rows, meta } = await conversationService.listForUser(
          req.principal,
          { status, search, cursor, limit: limit ?? 20 },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toConversationResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const conversation = await conversationService.getConversation(
          req.principal,
          req.validated.params.id,
        );
        res.status(200).json({
          success: true,
          data: toConversationResponse(conversation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async unreadCount(req, res, next) {
      try {
        const count = await conversationService.getUnreadConversationCount(
          req.principal,
        );
        res.status(200).json({
          success: true,
          data: toUnreadConversationCountResponse(count),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async markRead(req, res, next) {
      try {
        await conversationService.markAsRead(
          req.principal,
          req.validated.params.id,
          req.validated.body.lastReadMessageId,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async archive(req, res, next) {
      try {
        const conversation =
          await conversationService.setArchivedForParticipant(
            req.principal,
            req.validated.params.id,
            true,
          );
        res.status(200).json({
          success: true,
          data: toConversationResponse(conversation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async unarchive(req, res, next) {
      try {
        const conversation =
          await conversationService.setArchivedForParticipant(
            req.principal,
            req.validated.params.id,
            false,
          );
        res.status(200).json({
          success: true,
          data: toConversationResponse(conversation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createConversationController;
