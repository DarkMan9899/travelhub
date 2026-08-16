/**
 * MessageAttachmentService — Phase 14 (Messaging Platform).
 *
 * Reuses the existing `StorageProvider` port (Sprint 5 §8) exactly as
 * `listingService.attachMedia` already does — no new storage abstraction,
 * no provider-specific coupling here. Depends on `ConversationService`'s
 * public `assertCanWrite` for participant access control, never
 * re-implementing it.
 *
 * Publishes `ATTACHMENT_UPLOADED` after the file is durably stored and
 * the `media` row committed — matching every other event-publish rule
 * from Phase 13/14 (after the write, never inside a transaction).
 */

import {
  AuthenticationError,
  ValidationError,
} from '../../../errors/AppError.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';
import {
  isAllowedMimeType,
  isWithinSizeLimit,
  classifyMimeType,
} from '../../media/validators/mediaConstraints.js';

export class MessageAttachmentService {
  #messageAttachmentRepository;

  #conversationService;

  #storageProvider;

  #eventBus;

  constructor({
    messageAttachmentRepository,
    conversationService,
    storageProvider,
    eventBus = createNoOpEventBus(),
  }) {
    this.#messageAttachmentRepository = messageAttachmentRepository;
    this.#conversationService = conversationService;
    this.#storageProvider = storageProvider;
    this.#eventBus = eventBus;
  }

  async uploadAttachment(principal, conversationId, buffer, mimeType) {
    if (!principal) throw new AuthenticationError();
    await this.#conversationService.assertCanWrite(principal, conversationId);

    if (!isAllowedMimeType(mimeType)) {
      throw new ValidationError('Unsupported attachment type.');
    }
    if (!isWithinSizeLimit(mimeType, buffer.length)) {
      throw new ValidationError('Attachment exceeds the maximum allowed size.');
    }

    const category = classifyMimeType(mimeType); // 'image' | 'video' | 'document'
    const extension = mimeType.split('/')[1];
    const key = `messaging/${conversationId}/${Date.now()}-${principal.userId}.${extension}`;
    const { url } = await this.#storageProvider.put(key, buffer, {
      contentType: mimeType,
    });

    const media = await this.#messageAttachmentRepository.create({
      conversationId,
      mediaTypeCode: category.toUpperCase(),
      url,
      mimeType,
      fileSizeBytes: buffer.length,
      ownerUserId: principal.userId,
    });

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.ATTACHMENT_UPLOADED,
        actorId: principal.userId,
        resourceType: 'media',
        resourceId: media.id,
        payload: {
          conversationId,
          mediaId: media.id,
          mimeType: media.mimeType,
        },
      }),
    );

    return media;
  }
}

export default MessageAttachmentService;
