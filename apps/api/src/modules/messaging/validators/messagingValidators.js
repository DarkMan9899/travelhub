/**
 * Messaging module Zod validators (Layer 2, BACKEND_ARCHITECTURE.md
 * §10) — structural/format validation only. Participant/ownership
 * checks live in the Services, never here.
 */

import { z } from 'zod';

const passthroughQuery = z.object({}).passthrough();
const passthroughParams = z.object({}).passthrough();

export const createConversationSchema = z.object({
  params: passthroughParams,
  query: passthroughQuery,
  body: z.object({
    participantUserIds: z.array(z.number().int().positive()).min(1).max(20),
    contextType: z.string().trim().max(50).optional(),
    contextId: z.number().int().positive().optional(),
  }),
});

export const listConversationsQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    status: z.enum(['all', 'archived']).optional(),
    search: z.string().trim().max(255).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

export const conversationIdParamsSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.any(),
});

export const markConversationReadSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z.object({
    lastReadMessageId: z.number().int().positive(),
  }),
});

export const sendMessageSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: passthroughQuery,
  body: z
    .object({
      // An attachment-only message (no caption) is a real, common case —
      // the body only needs to be non-empty when there's no attachment
      // to carry the message instead (see the `.refine` below).
      body: z.string().trim().max(4000),
      attachmentMediaIds: z
        .array(z.number().int().positive())
        .max(10)
        .optional(),
    })
    .refine(
      (value) =>
        value.body.length > 0 || (value.attachmentMediaIds?.length ?? 0) > 0,
      {
        message: 'A message needs a body or at least one attachment.',
        path: ['body'],
      },
    ),
});

export const listMessagesQuerySchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  query: z.object({
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});

// Nested under `/conversations/:id/messages/:messageId` — both ids are
// present in `req.params`, even though the Service only ever needs
// `messageId` (a message's own conversation is resolved from the
// message record itself); validating both keeps the route param shape
// self-documenting.
export const messageIdParamsSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    messageId: z.coerce.number().int().positive(),
  }),
  query: passthroughQuery,
  body: z.any(),
});

// A small, fixed set — genuinely just a short enum, not an admin-
// editable domain (unlike notification categories), so this stays a
// Zod enum rather than a new lookup table.
export const REACTION_CODES = ['👍', '❤️', '😂', '😮', '😢', '👏'];

export const toggleReactionSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive(),
    messageId: z.coerce.number().int().positive(),
  }),
  query: passthroughQuery,
  body: z.object({
    reactionCode: z.enum(REACTION_CODES),
  }),
});

// Deliberately `/messaging/messages/search`, not nested under
// `/conversations`, so it never collides with the `/conversations/:id`
// route pattern and isn't scoped to a single conversation.
export const searchMessagesQuerySchema = z.object({
  params: passthroughParams,
  query: z.object({
    q: z.string().trim().min(1).max(255),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
  body: z.any(),
});
