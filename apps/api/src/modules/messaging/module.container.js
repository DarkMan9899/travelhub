/**
 * Messaging module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `permissionResolver`/`auditLogger`/`eventBus` as injected
 * dependencies from the composition root — same shared instances every
 * other module uses, never a second copy. Messaging never imports
 * anything from `notifications` — the dependency direction (Messaging
 * publishes, Notifications subscribes) is enforced by this file simply
 * never importing that module.
 */

import { MySqlConversationRepository } from './repositories/mysqlConversationRepository.js';
import { MySqlMessageRepository } from './repositories/mysqlMessageRepository.js';
import { MySqlMessageReactionRepository } from './repositories/mysqlMessageReactionRepository.js';
import { MySqlMessageAttachmentRepository } from './repositories/mysqlMessageAttachmentRepository.js';
import { ConversationService } from './services/conversationService.js';
import { MessageService } from './services/messageService.js';
import { MessageReactionService } from './services/messageReactionService.js';
import { MessageAttachmentService } from './services/messageAttachmentService.js';
import { TypingIndicatorService } from './services/typingIndicatorService.js';
import { createConversationController } from './controllers/conversationController.js';
import { createMessageController } from './controllers/messageController.js';
import { createTypingController } from './controllers/typingController.js';
import { LocalStorageProvider } from '../../infrastructure/storage/localStorageProvider.js';

export default function createMessagingContainer({
  permissionResolver,
  auditLogger,
  eventBus,
}) {
  const conversationRepository = new MySqlConversationRepository();
  const messageRepository = new MySqlMessageRepository();
  const messageReactionRepository = new MySqlMessageReactionRepository();
  const messageAttachmentRepository = new MySqlMessageAttachmentRepository();
  const storageProvider = new LocalStorageProvider();

  const conversationService = new ConversationService({
    conversationRepository,
    permissionResolver,
    auditLogger,
    eventBus,
  });

  const messageService = new MessageService({
    messageRepository,
    conversationRepository,
    conversationService,
    messageAttachmentRepository,
    messageReactionRepository,
    permissionResolver,
    eventBus,
  });

  const messageReactionService = new MessageReactionService({
    messageReactionRepository,
    messageRepository,
    conversationService,
  });

  const messageAttachmentService = new MessageAttachmentService({
    messageAttachmentRepository,
    conversationService,
    storageProvider,
    eventBus,
  });

  const typingIndicatorService = new TypingIndicatorService({
    conversationService,
  });

  const conversationController =
    createConversationController(conversationService);
  const messageController = createMessageController(
    messageService,
    messageReactionService,
    messageAttachmentService,
  );
  const typingController = createTypingController(typingIndicatorService);

  return {
    conversationRepository,
    messageRepository,
    messageReactionRepository,
    messageAttachmentRepository,
    conversationService,
    messageService,
    messageReactionService,
    messageAttachmentService,
    typingIndicatorService,
    conversationController,
    messageController,
    typingController,
  };
}
