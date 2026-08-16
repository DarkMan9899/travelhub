import { describe, test, expect } from '@jest/globals';
import { LocalHeuristicProvider } from '../../../../src/modules/ai/providers/localHeuristicProvider.js';
import {
  buildSystemPrompt,
  buildUserPrompt,
} from '../../../../src/modules/ai/prompts/promptGrounding.js';
import { FEATURE_CODES } from '../../../../src/modules/ai/constants/featureCodes.js';

function messagesFor(featureCode, context, userText = 'Please help.') {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(featureCode, 'Instructions.'),
    },
    { role: 'user', content: buildUserPrompt(userText, context) },
  ];
}

describe('LocalHeuristicProvider', () => {
  test('code is "local"', () => {
    expect(new LocalHeuristicProvider().code).toBe('local');
  });

  test('composes a trip planner narrative grounded in real listing data', async () => {
    const provider = new LocalHeuristicProvider();
    const { content } = await provider.complete({
      messages: messagesFor(FEATURE_CODES.TRIP_PLANNER, {
        destination: 'Yerevan',
        days: 2,
        budget: 500,
        currency: 'AMD',
        dailyPlan: [
          {
            day: 1,
            listings: [{ title: 'Central Hotel', pricePerNight: 100 }],
          },
        ],
      }),
    });
    expect(content).toContain('Yerevan');
    expect(content).toContain('Central Hotel');
    expect(content).toContain('500');
  });

  test('search_parse extracts real keyword-based filter hints', async () => {
    const provider = new LocalHeuristicProvider();
    const { content } = await provider.complete({
      messages: messagesFor(FEATURE_CODES.SEARCH_PARSE, {
        query: 'quiet cabin near a lake, pet-friendly, under 200',
      }),
    });
    const parsed = JSON.parse(content);
    expect(parsed.parsedFilters.amenityKeywords).toEqual(
      expect.arrayContaining(['quiet', 'pet']),
    );
    expect(parsed.parsedFilters.locationKeywords).toEqual(
      expect.arrayContaining(['lake']),
    );
    expect(parsed.parsedFilters.categoryKeywords).toEqual(
      expect.arrayContaining(['cabin']),
    );
    expect(parsed.parsedFilters.maxPrice).toBe(200);
  });

  test('assistant answers a grounded cancellation-policy question', async () => {
    const provider = new LocalHeuristicProvider();
    const { content } = await provider.complete({
      messages: messagesFor(
        FEATURE_CODES.ASSISTANT,
        { policies: { cancellation: 'Free cancellation within 48 hours.' } },
        'What is the cancellation policy?',
      ),
    });
    expect(content).toContain('Free cancellation within 48 hours.');
  });

  test('assistant never hallucinates — says it does not know when ungrounded', async () => {
    const provider = new LocalHeuristicProvider();
    const { content } = await provider.complete({
      messages: messagesFor(
        FEATURE_CODES.ASSISTANT,
        {},
        'What is the meaning of life?',
      ),
    });
    expect(content.toLowerCase()).toContain("don't have");
  });

  test('listing translation is honestly labeled as untranslated, never a fake translation', async () => {
    const provider = new LocalHeuristicProvider();
    const { content } = await provider.complete({
      messages: messagesFor(FEATURE_CODES.LISTING_TRANSLATE, {
        text: 'A cozy apartment.',
        targetLanguageCode: 'hy',
      }),
    });
    expect(content).toContain('untranslated');
    expect(content).toContain('A cozy apartment.');
  });

  test('an unrecognized feature code degrades to an honest "not enough context" answer', async () => {
    const provider = new LocalHeuristicProvider();
    const { content } = await provider.complete({
      messages: [
        { role: 'system', content: 'no feature tag here' },
        { role: 'user', content: 'hello' },
      ],
    });
    expect(content).toContain("don't have enough grounded context");
  });

  test('stream() yields the same content word-by-word, ending with a done chunk', async () => {
    const provider = new LocalHeuristicProvider();
    const chunks = [];
    for await (const chunk of provider.stream({
      messages: messagesFor(FEATURE_CODES.LISTING_TITLE, {
        category: 'Hotel',
        city: 'Yerevan',
      }),
    })) {
      chunks.push(chunk);
    }
    const last = chunks[chunks.length - 1];
    expect(last.done).toBe(true);
    expect(last.model).toBe('local-heuristic-v1');
    const assembled = chunks.map((c) => c.delta).join('');
    expect(assembled).toContain('Hotel');
    expect(assembled).toContain('Yerevan');
  });
});
