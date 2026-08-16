/**
 * AssistantService (Stage 15.3) — a contextual Q&A assistant grounded in
 * a real listing or booking, never a free-standing chatbot. `resolveContext`
 * is the anti-hallucination gate: it calls the exact same
 * ownership-checked `listingService.getListing`/`bookingService.getBooking`
 * reads every other feature uses, so a user can only ever ground the
 * assistant in data they're already allowed to see — an unpublished
 * listing or someone else's booking simply 404s the same way it would
 * anywhere else in the app, never a special "AI bypass".
 *
 * Conversation persistence reuses `AiConversationService` (the same
 * generic thread primitive `TripPlannerService` uses), scoped to
 * `feature_code = 'assistant'`.
 */

import {
  AuthenticationError,
  ValidationError,
} from '../../../errors/AppError.js';
import { buildAssistantPrompt } from '../prompts/travelAssistant.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const SUPPORTED_CONTEXT_TYPES = new Set(['listing', 'booking']);

export class AssistantService {
  #listingService;

  #bookingService;

  #aiService;

  #aiConversationService;

  constructor({
    listingService,
    bookingService,
    aiService,
    aiConversationService,
  }) {
    this.#listingService = listingService;
    this.#bookingService = bookingService;
    this.#aiService = aiService;
    this.#aiConversationService = aiConversationService;
  }

  async #resolveContext(principal, contextType, contextId) {
    if (!contextType || !contextId) return {};
    if (!SUPPORTED_CONTEXT_TYPES.has(contextType)) {
      throw new ValidationError('Unsupported assistant context type.', [
        { field: 'contextType', issue: 'UNSUPPORTED' },
      ]);
    }
    if (contextType === 'listing') {
      const listing = await this.#listingService.getListing(
        principal,
        contextId,
      );
      const title = listing.translations?.[0]?.title ?? null;
      return {
        listing: {
          title,
          cityName: listing.location?.cityName ?? null,
          pricePerNight: listing.pricing?.amount ?? null,
          currency: listing.pricing?.currencyCode ?? null,
        },
        policies: {
          cancellation:
            listing.policyValues?.find(
              (value) => value.code === 'cancellation_policy',
            )?.value ?? null,
        },
        amenities: [],
      };
    }
    // contextType === 'booking'
    const booking = await this.#bookingService.getBooking(principal, contextId);
    return {
      booking: {
        bookingReference: booking.bookingReference,
        statusCode: booking.statusCode,
        totalAmount: booking.totalAmount,
        currency: booking.currencyCode,
        tripDateFrom: booking.tripDateFrom,
        tripDateTo: booking.tripDateTo,
      },
    };
  }

  async #loadHistory(principal, conversationId) {
    if (!conversationId) return [];
    const conversation =
      await this.#aiConversationService.getConversationWithMessages(
        principal,
        conversationId,
      );
    return conversation.messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));
  }

  /**
   * Resolves everything a call to the AI gateway needs, shared by both
   * the synchronous `ask` and the SSE `streamAsk` — kept as one method so
   * the two entry points can never drift on grounding/ownership rules.
   */
  async #prepare(
    principal,
    { contextType, contextId, conversationId, message },
  ) {
    if (!principal) throw new AuthenticationError();
    const trimmedMessage = (message ?? '').trim();
    if (!trimmedMessage) {
      throw new ValidationError('A message is required.', [
        { field: 'message', issue: 'REQUIRED' },
      ]);
    }
    const context = await this.#resolveContext(
      principal,
      contextType,
      contextId,
    );
    const history = await this.#loadHistory(principal, conversationId);
    const messages = buildAssistantPrompt({
      context,
      history: [...history, { role: 'user', content: trimmedMessage }],
    });
    return { trimmedMessage, messages };
  }

  async #persistTurn(
    principal,
    {
      conversationId,
      userMessage,
      assistantContent,
      providerCode,
      model,
      usage,
      cacheHit,
    },
  ) {
    let conversation;
    if (conversationId) {
      conversation =
        await this.#aiConversationService.getConversationWithMessages(
          principal,
          conversationId,
        );
    } else {
      conversation = await this.#aiConversationService.createConversation(
        principal,
        {
          featureCode: FEATURE_CODES.ASSISTANT,
          title: userMessage.slice(0, 80),
        },
      );
    }
    await this.#aiConversationService.appendMessage(conversation.id, {
      role: 'user',
      content: userMessage,
    });
    await this.#aiConversationService.appendMessage(conversation.id, {
      role: 'assistant',
      content: assistantContent,
      providerCode,
      model,
      promptTokens: usage?.promptTokens ?? null,
      completionTokens: usage?.completionTokens ?? null,
      cacheHit,
    });
    return conversation.id;
  }

  async ask(principal, input) {
    const { trimmedMessage, messages } = await this.#prepare(principal, input);
    const { content, providerCode, model, usage, cacheHit } =
      await this.#aiService.complete({
        principal,
        featureCode: FEATURE_CODES.ASSISTANT,
        messages,
      });
    const conversationId = await this.#persistTurn(principal, {
      conversationId: input.conversationId,
      userMessage: trimmedMessage,
      assistantContent: content,
      providerCode,
      model,
      usage,
      cacheHit,
    });
    return { conversationId, message: content, providerCode };
  }

  /**
   * The SSE entry point. Yields `{delta, done}` chunks as they arrive from
   * `aiService.stream()` and persists the full turn only once streaming
   * completes — a client that disconnects mid-stream simply loses that
   * turn's history, never a half-written message row.
   */
  async *streamAsk(principal, input) {
    const { trimmedMessage, messages } = await this.#prepare(principal, input);
    let fullContent = '';
    let model = null;
    let usage = null;
    for await (const chunk of this.#aiService.stream({
      principal,
      featureCode: FEATURE_CODES.ASSISTANT,
      messages,
    })) {
      if (chunk.delta) fullContent += chunk.delta;
      if (chunk.model) model = chunk.model;
      if (chunk.usage) usage = chunk.usage;
      yield chunk;
    }
    const conversationId = await this.#persistTurn(principal, {
      conversationId: input.conversationId,
      userMessage: trimmedMessage,
      assistantContent: fullContent,
      // `aiService.stream()` yields provider chunks as-is (unlike
      // `complete()`, it never annotates them with `providerCode`) — the
      // real attribution already lives in `ai_usage_logs` via
      // `aiUsageService`; this row's `provider_code` is honestly left
      // null rather than guessed.
      providerCode: null,
      model,
      usage,
      cacheHit: false,
    });
    yield { delta: '', done: true, conversationId };
  }

  async listConversations(principal, filters = {}) {
    if (!principal) throw new AuthenticationError();
    return this.#aiConversationService.listForUser(principal, {
      ...filters,
      featureCode: FEATURE_CODES.ASSISTANT,
    });
  }

  async getConversation(principal, conversationId) {
    return this.#aiConversationService.getConversationWithMessages(
      principal,
      conversationId,
    );
  }

  async deleteConversation(principal, conversationId) {
    return this.#aiConversationService.deleteConversation(
      principal,
      conversationId,
    );
  }
}

export default AssistantService;
