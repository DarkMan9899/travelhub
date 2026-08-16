import { describe, test, expect, jest } from '@jest/globals';
import { AssistantService } from '../../../../src/modules/ai/services/assistantService.js';
import {
  AuthenticationError,
  ValidationError,
  NotFoundError,
} from '../../../../src/errors/AppError.js';

const PRINCIPAL = { userId: 1, roles: ['CUSTOMER'] };

const LISTING = {
  translations: [{ title: 'Central Hotel' }],
  location: { cityName: 'Yerevan' },
  pricing: { amount: '100.00', currencyCode: 'AMD' },
  policyValues: [{ code: 'cancellation_policy', value: 'FLEXIBLE' }],
};

const BOOKING = {
  bookingReference: 'BK-1',
  statusCode: 'CONFIRMED',
  totalAmount: '200.00',
  currencyCode: 'AMD',
  tripDateFrom: '2026-01-01',
  tripDateTo: '2026-01-03',
};

function buildService(overrides = {}) {
  const listingService = {
    getListing: jest.fn().mockResolvedValue(LISTING),
    ...overrides.listingService,
  };
  const bookingService = {
    getBooking: jest.fn().mockResolvedValue(BOOKING),
    ...overrides.bookingService,
  };
  const aiService = {
    complete: jest.fn().mockResolvedValue({
      content: 'Cancellation is flexible.',
      providerCode: 'local',
      model: 'local-heuristic-v1',
      usage: { promptTokens: 5, completionTokens: 5 },
      cacheHit: false,
    }),
    stream: jest.fn(async function* stream() {
      yield { delta: 'Cancel', done: false };
      yield { delta: 'lation', done: false };
      yield { delta: '', done: true, model: 'local-heuristic-v1' };
    }),
    ...overrides.aiService,
  };
  const aiConversationService = {
    createConversation: jest.fn().mockResolvedValue({ id: 42 }),
    appendMessage: jest.fn().mockResolvedValue(undefined),
    getConversationWithMessages: jest
      .fn()
      .mockResolvedValue({ id: 42, messages: [] }),
    listForUser: jest.fn().mockResolvedValue({ rows: [], meta: {} }),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
    ...overrides.aiConversationService,
  };
  const service = new AssistantService({
    listingService,
    bookingService,
    aiService,
    aiConversationService,
  });
  return {
    service,
    listingService,
    bookingService,
    aiService,
    aiConversationService,
  };
}

describe('AssistantService', () => {
  test('ask requires a principal', async () => {
    const { service } = buildService();
    await expect(service.ask(null, { message: 'Hi' })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });

  test('ask requires a non-empty message', async () => {
    const { service } = buildService();
    await expect(
      service.ask(PRINCIPAL, { message: '   ' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('rejects an unsupported context type', async () => {
    const { service } = buildService();
    await expect(
      service.ask(PRINCIPAL, {
        message: 'Hi',
        contextType: 'notification',
        contextId: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  test('grounds a listing context via the real ownership-checked listingService.getListing, never a second Repository', async () => {
    const { service, listingService, aiService } = buildService();
    await service.ask(PRINCIPAL, {
      message: 'What is the cancellation policy?',
      contextType: 'listing',
      contextId: 7,
    });
    expect(listingService.getListing).toHaveBeenCalledWith(PRINCIPAL, 7);
    const { messages } = aiService.complete.mock.calls[0][0];
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.content).toContain('Central Hotel');
    expect(lastMessage.content).toContain('FLEXIBLE');
  });

  test('grounds a booking context via the real ownership-checked bookingService.getBooking', async () => {
    const { service, bookingService, aiService } = buildService();
    await service.ask(PRINCIPAL, {
      message: 'How much did I pay?',
      contextType: 'booking',
      contextId: 9,
    });
    expect(bookingService.getBooking).toHaveBeenCalledWith(PRINCIPAL, 9);
    const { messages } = aiService.complete.mock.calls[0][0];
    const lastMessage = messages[messages.length - 1];
    expect(lastMessage.content).toContain('BK-1');
  });

  test('a listing lookup failure (unowned/unpublished) propagates, never silently ignored', async () => {
    const { service } = buildService({
      listingService: {
        getListing: jest
          .fn()
          .mockRejectedValue(new NotFoundError('Listing not found.')),
      },
    });
    await expect(
      service.ask(PRINCIPAL, {
        message: 'Hi',
        contextType: 'listing',
        contextId: 99,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  test('ask creates a new conversation and persists both turns when no conversationId is supplied', async () => {
    const { service, aiConversationService } = buildService();
    const result = await service.ask(PRINCIPAL, { message: 'Hi' });
    expect(result.conversationId).toBe(42);
    expect(aiConversationService.createConversation).toHaveBeenCalledWith(
      PRINCIPAL,
      expect.objectContaining({ featureCode: 'assistant' }),
    );
    expect(aiConversationService.appendMessage).toHaveBeenCalledTimes(2);
  });

  test('ask appends to an existing conversation when conversationId is supplied', async () => {
    const { service, aiConversationService } = buildService();
    await service.ask(PRINCIPAL, { message: 'Hi', conversationId: 42 });
    expect(aiConversationService.createConversation).not.toHaveBeenCalled();
    expect(
      aiConversationService.getConversationWithMessages,
    ).toHaveBeenCalledWith(PRINCIPAL, 42);
  });

  test('streamAsk yields provider chunks and persists the full assembled turn once done', async () => {
    const { service, aiConversationService } = buildService();
    const chunks = [];
    for await (const chunk of service.streamAsk(PRINCIPAL, {
      message: 'Hi',
    })) {
      chunks.push(chunk);
    }
    expect(chunks.some((chunk) => chunk.delta === 'Cancel')).toBe(true);
    expect(chunks[chunks.length - 1]).toEqual(
      expect.objectContaining({ done: true, conversationId: 42 }),
    );
    expect(aiConversationService.appendMessage).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ role: 'assistant', content: 'Cancellation' }),
    );
  });

  test('listConversations scopes to the assistant feature code', async () => {
    const { service, aiConversationService } = buildService();
    await service.listConversations(PRINCIPAL, {});
    expect(aiConversationService.listForUser).toHaveBeenCalledWith(
      PRINCIPAL,
      expect.objectContaining({ featureCode: 'assistant' }),
    );
  });

  test('deleteConversation delegates to aiConversationService', async () => {
    const { service, aiConversationService } = buildService();
    await service.deleteConversation(PRINCIPAL, 42);
    expect(aiConversationService.deleteConversation).toHaveBeenCalledWith(
      PRINCIPAL,
      42,
    );
  });
});
