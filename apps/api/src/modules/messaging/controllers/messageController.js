/**
 * Message Controller (BACKEND_ARCHITECTURE.md Ch.5): parse input -> call
 * Service -> shape response. No business logic.
 */

import { ValidationError } from '../../../errors/AppError.js';
import {
  toMessageResponse,
  toReactionToggleResponse,
  toAttachmentResponse,
} from '../dto/messageDto.js';

export function createMessageController(
  messageService,
  messageReactionService,
  messageAttachmentService,
) {
  return {
    async send(req, res, next) {
      try {
        const message = await messageService.sendMessage(
          req.principal,
          req.validated.params.id,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toMessageResponse(message),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const { cursor, limit } = req.validated.query;
        const { rows, meta } = await messageService.listForConversation(
          req.principal,
          req.validated.params.id,
          { cursor, limit: limit ?? 30 },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toMessageResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        await messageService.softDeleteMessage(
          req.principal,
          req.validated.params.messageId,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async search(req, res, next) {
      try {
        const { q, cursor, limit } = req.validated.query;
        const { rows, meta } = await messageService.searchMessages(
          req.principal,
          q,
          { cursor, limit: limit ?? 20 },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toMessageResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async toggleReaction(req, res, next) {
      try {
        const result = await messageReactionService.toggleReaction(
          req.principal,
          req.validated.params.messageId,
          req.validated.body.reactionCode,
        );
        res.status(200).json({
          success: true,
          data: toReactionToggleResponse(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async uploadAttachment(req, res, next) {
      try {
        const { id } = req.validated.params;
        const buffer = req.body;
        const mimeType = req.headers['content-type'];

        // Gross size/DoS protection lives in module.routes.js's
        // express.raw({ limit }); this only guards an empty/missing body,
        // matching the exact precedent listingController.attachMedia sets.
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
          throw new ValidationError('Request body must be a non-empty file.');
        }

        const media = await messageAttachmentService.uploadAttachment(
          req.principal,
          id,
          buffer,
          mimeType,
        );
        res.status(201).json({
          success: true,
          data: toAttachmentResponse(media),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createMessageController;
