/**
 * Messaging module route wiring (BACKEND_ARCHITECTURE.md §2: route
 * wiring only, no logic). Every route is `requireAuth` — conversation
 * access is a participant ownership check in the Service (or
 * `messaging.view_all` for reads), never permission-key RBAC at the
 * route level.
 */

import express, { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  createConversationSchema,
  listConversationsQuerySchema,
  conversationIdParamsSchema,
  markConversationReadSchema,
  sendMessageSchema,
  listMessagesQuerySchema,
  messageIdParamsSchema,
  toggleReactionSchema,
  searchMessagesQuerySchema,
} from './validators/messagingValidators.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_DOCUMENT_MIME_TYPES,
} from '../media/validators/mediaConstraints.js';

// Images + documents only, per Phase 14's brief ("future videos") — not
// videos yet, matching the module's Attachments scope decision.
const ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_DOCUMENT_MIME_TYPES,
];

export default function createMessagingRoutes({
  conversationController,
  messageController,
  typingController,
  guards,
}) {
  const router = Router();
  const { requireAuth } = guards;

  router.get(
    '/conversations',
    requireAuth,
    validate(listConversationsQuerySchema),
    conversationController.list,
  );

  router.post(
    '/conversations',
    requireAuth,
    validate(createConversationSchema),
    conversationController.create,
  );

  router.get(
    '/conversations/unread-count',
    requireAuth,
    conversationController.unreadCount,
  );

  router.get(
    '/conversations/:id',
    requireAuth,
    validate(conversationIdParamsSchema),
    conversationController.getById,
  );

  router.patch(
    '/conversations/:id/read',
    requireAuth,
    validate(markConversationReadSchema),
    conversationController.markRead,
  );

  router.patch(
    '/conversations/:id/archive',
    requireAuth,
    validate(conversationIdParamsSchema),
    conversationController.archive,
  );

  router.patch(
    '/conversations/:id/unarchive',
    requireAuth,
    validate(conversationIdParamsSchema),
    conversationController.unarchive,
  );

  // Registered before the nested `/conversations/:id/messages` routes so
  // it never has to compete with them for a match — no path collision
  // risk either way, since it lives outside `/conversations` entirely.
  router.get(
    '/messages/search',
    requireAuth,
    validate(searchMessagesQuerySchema),
    messageController.search,
  );

  router.get(
    '/conversations/:id/messages',
    requireAuth,
    validate(listMessagesQuerySchema),
    messageController.list,
  );

  router.post(
    '/conversations/:id/messages',
    requireAuth,
    validate(sendMessageSchema),
    messageController.send,
  );

  router.delete(
    '/conversations/:id/messages/:messageId',
    requireAuth,
    validate(messageIdParamsSchema),
    messageController.remove,
  );

  router.post(
    '/conversations/:id/messages/:messageId/reactions',
    requireAuth,
    validate(toggleReactionSchema),
    messageController.toggleReaction,
  );

  // Two-step attachment flow (Stage 14.3): upload first, reference the
  // returned media id from `POST /conversations/:id/messages`'s
  // `attachmentMediaIds` — mirrors the listings module's media route
  // exactly, scoped `express.raw` so the global JSON body parser skips it.
  router.post(
    '/conversations/:id/attachments',
    requireAuth,
    express.raw({ type: ALLOWED_MESSAGE_ATTACHMENT_MIME_TYPES, limit: '20mb' }),
    validate(conversationIdParamsSchema),
    messageController.uploadAttachment,
  );

  // Typing indicator (Stage 14.3): ephemeral, Redis-only — see
  // typingIndicatorService.js. Polled by the frontend while a thread is
  // open, never persisted to MySQL.
  router.post(
    '/conversations/:id/typing',
    requireAuth,
    validate(conversationIdParamsSchema),
    typingController.setTyping,
  );

  router.get(
    '/conversations/:id/typing',
    requireAuth,
    validate(conversationIdParamsSchema),
    typingController.listTyping,
  );

  return router;
}
