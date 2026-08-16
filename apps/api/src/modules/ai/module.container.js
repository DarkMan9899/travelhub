/**
 * AI module DI container (Phase 15, BACKEND_ARCHITECTURE.md §17).
 *
 * Grows across Stages 15.1-15.6 as each feature service is added; this
 * file's Stage 15.0 shape wires only the shared foundation every feature
 * depends on: the provider registry, `AiService` itself, usage/memory
 * services, and the `/ai/memory` read/delete surface.
 *
 * Takes `permissionResolver`/`auditLogger`/`eventBus` plus
 * `bookingService`/`listingService` (for `aiListener.js`'s cross-module
 * reads) as injected dependencies from the composition root — never a
 * second Repository over another module's table.
 */

import config from '../../config/index.js';
import { ProviderRegistry } from './providers/providerRegistry.js';
import { AiCacheService } from './services/aiCacheService.js';
import { MySqlAiUsageRepository } from './repositories/mysqlAiUsageRepository.js';
import { AiUsageService } from './services/aiUsageService.js';
import { AiService } from './services/aiService.js';
import { MySqlAiMemoryRepository } from './repositories/mysqlAiMemoryRepository.js';
import { AiMemoryService } from './services/aiMemoryService.js';
import { createAiMemoryController } from './controllers/aiMemoryController.js';
import { MySqlAiConversationRepository } from './repositories/mysqlAiConversationRepository.js';
import { MySqlAiMessageRepository } from './repositories/mysqlAiMessageRepository.js';
import { AiConversationService } from './services/aiConversationService.js';
import { TripPlannerService } from './services/tripPlannerService.js';
import { createTripPlannerController } from './controllers/tripPlannerController.js';
import { AiSearchService } from './services/aiSearchService.js';
import { createAiSearchController } from './controllers/aiSearchController.js';
import { AssistantService } from './services/assistantService.js';
import { createAssistantController } from './controllers/assistantController.js';
import { RecommendationService } from './services/recommendationService.js';
import { createRecommendationController } from './controllers/recommendationController.js';
import { PartnerAiService } from './services/partnerAiService.js';
import { createPartnerAiController } from './controllers/partnerAiController.js';
import { ModerationHeuristicsService } from './services/moderationHeuristicsService.js';
import { createModerationController } from './controllers/moderationController.js';
import { createAiUsageController } from './controllers/aiUsageController.js';

export default function createAiContainer({
  permissionResolver,
  auditLogger,
  searchService,
  listingService,
  bookingService,
}) {
  const providerRegistry = new ProviderRegistry({ aiConfig: config.ai });
  const aiCacheService = new AiCacheService({
    ttlSeconds: config.ai.cacheTtlSeconds,
  });
  const aiUsageRepository = new MySqlAiUsageRepository();
  const aiUsageService = new AiUsageService({ aiUsageRepository });
  const aiService = new AiService({
    providerRegistry,
    aiCacheService,
    aiUsageService,
    maxRetries: config.ai.maxRetries,
  });

  const aiMemoryRepository = new MySqlAiMemoryRepository();
  const aiMemoryService = new AiMemoryService({ aiMemoryRepository });
  const aiMemoryController = createAiMemoryController(aiMemoryService);

  const aiConversationRepository = new MySqlAiConversationRepository();
  const aiMessageRepository = new MySqlAiMessageRepository();
  const aiConversationService = new AiConversationService({
    aiConversationRepository,
    aiMessageRepository,
  });

  const tripPlannerService = new TripPlannerService({
    searchService,
    aiService,
    aiConversationService,
  });
  const tripPlannerController = createTripPlannerController(tripPlannerService);

  const aiSearchService = new AiSearchService({ searchService, aiService });
  const aiSearchController = createAiSearchController(aiSearchService);

  const assistantService = new AssistantService({
    listingService,
    bookingService,
    aiService,
    aiConversationService,
  });
  const assistantController = createAssistantController(assistantService);

  const recommendationService = new RecommendationService({
    aiMemoryService,
    searchService,
    aiService,
    bookingService,
  });
  const recommendationController = createRecommendationController(
    recommendationService,
  );

  const partnerAiService = new PartnerAiService({
    listingService,
    searchService,
    aiService,
    permissionResolver,
  });
  const partnerAiController = createPartnerAiController(partnerAiService);

  const moderationHeuristicsService = new ModerationHeuristicsService({
    listingService,
    aiService,
  });
  const moderationController = createModerationController(
    moderationHeuristicsService,
  );

  const aiUsageController = createAiUsageController(aiUsageService);

  return {
    providerRegistry,
    aiCacheService,
    aiUsageService,
    aiService,
    aiMemoryService,
    aiMemoryController,
    aiConversationService,
    tripPlannerService,
    tripPlannerController,
    aiSearchService,
    aiSearchController,
    assistantService,
    assistantController,
    recommendationService,
    recommendationController,
    partnerAiService,
    partnerAiController,
    moderationHeuristicsService,
    moderationController,
    aiUsageController,
    permissionResolver,
    auditLogger,
  };
}
