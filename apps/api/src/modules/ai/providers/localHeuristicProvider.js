/**
 * LocalHeuristicProvider — the default `AIProvider` implementation
 * (Phase 15). Mirrors Phase 13's `ConsoleEmailProvider` precedent exactly:
 * a real, observable, zero-external-dependency default every other
 * provider adapter swaps in for — not a canned stub. It reads the real
 * grounding data every prompt module embeds (see `prompts/promptGrounding.js`)
 * and composes a genuinely data-driven response via deterministic
 * templates/keyword rules, keyed off the `[[ai-feature:<code>]]` tag every
 * system prompt is prefixed with.
 *
 * This is what `test`/`demo`/CI actually exercise, since no third-party
 * API key exists in this environment — every other adapter in this
 * directory is real but only unit-tested against mocked HTTP responses.
 *
 * `stream()` chunks the same deterministic text word-by-word with a small
 * delay, so the SAME streaming code path a real provider's token stream
 * would use is genuinely exercised end-to-end today.
 */

import { AIProvider } from './AIProvider.js';
import {
  extractFeatureCode,
  extractContext,
} from '../prompts/promptGrounding.js';
import { FEATURE_CODES } from '../constants/featureCodes.js';

const MODEL_NAME = 'local-heuristic-v1';

function estimateTokens(text) {
  // Rough, deterministic word-count-based estimate — good enough for a
  // provider that never bills anyone; real adapters report the provider's
  // own authoritative usage figures instead of estimating.
  return Math.max(1, Math.ceil(String(text).trim().split(/\s+/).length * 1.3));
}

function money(amount, currency = 'AMD') {
  if (amount === undefined || amount === null) return 'an unlisted price';
  return `${Number(amount).toLocaleString('en-US')} ${currency}`;
}

function composeTripPlanner(context) {
  const {
    destination = 'Armenia',
    days = 3,
    budget,
    currency = 'AMD',
    interests = [],
    dailyPlan = [],
  } = context;
  const interestPhrase = interests.length
    ? ` with a focus on ${interests.join(', ')}`
    : '';
  const lines = [
    `Here is a ${days}-day plan for ${destination}${interestPhrase}, built from ` +
      `currently published listings within your ${money(budget, currency)} budget.`,
  ];
  dailyPlan.forEach((day) => {
    const items = (day.listings ?? [])
      .map(
        (listing) =>
          `${listing.title} (${money(listing.pricePerNight, currency)}/night)`,
      )
      .join('; ');
    lines.push(
      `Day ${day.day}${day.theme ? ` — ${day.theme}` : ''}: ${
        items || 'no matching published listings for this day yet'
      }.`,
    );
  });
  lines.push(
    'Prices and availability come directly from the marketplace catalog above — ' +
      'double-check the listing page before booking, since availability can change.',
  );
  return lines.join('\n');
}

function composeSearchParse(context) {
  const query = String(context.query ?? '').toLowerCase();
  const filters = {};
  const KEYWORD_HINTS = [
    { pattern: /\bpet[- ]?friendly\b/, key: 'amenityKeywords', value: 'pet' },
    { pattern: /\bspa\b/, key: 'amenityKeywords', value: 'spa' },
    { pattern: /\bpool\b/, key: 'amenityKeywords', value: 'pool' },
    { pattern: /\bquiet\b/, key: 'amenityKeywords', value: 'quiet' },
    { pattern: /\blake\b/, key: 'locationKeywords', value: 'lake' },
    { pattern: /\bmountain\b/, key: 'locationKeywords', value: 'mountain' },
    { pattern: /\bluxury\b/, key: 'tierKeywords', value: 'luxury' },
    { pattern: /\bbudget\b|\bcheap\b/, key: 'tierKeywords', value: 'budget' },
    { pattern: /\bcabin\b/, key: 'categoryKeywords', value: 'cabin' },
    { pattern: /\bhotel\b/, key: 'categoryKeywords', value: 'hotel' },
    { pattern: /\bapartment\b/, key: 'categoryKeywords', value: 'apartment' },
    { pattern: /\btour\b/, key: 'categoryKeywords', value: 'tour' },
  ];
  KEYWORD_HINTS.forEach(({ pattern, key, value }) => {
    if (pattern.test(query)) {
      filters[key] = [...(filters[key] ?? []), value];
    }
  });
  const priceMatch = query.match(/\bunder\s+(\d+)\b/);
  if (priceMatch) {
    filters.maxPrice = Number(priceMatch[1]);
  }
  return JSON.stringify({
    parsedFilters: filters,
    originalQuery: context.query ?? '',
  });
}

function composeAssistant(context, latestUserMessage) {
  const question = String(latestUserMessage ?? '').toLowerCase();
  const { listing, booking, policies, amenities } = context;

  if (/cancel|refund/.test(question) && policies) {
    return policies.cancellation
      ? `Cancellation policy: ${policies.cancellation}`
      : "I don't have a cancellation policy on file for this listing.";
  }
  if (/pet/.test(question) && amenities) {
    const allowsPets = amenities.some((amenity) => /pet/i.test(amenity));
    return allowsPets
      ? 'Yes — this listing allows pets, per its amenities list.'
      : "This listing's amenities list doesn't mention pets, so I can't confirm they're allowed.";
  }
  if (
    /price|cost|how much/.test(question) &&
    (listing?.pricePerNight || booking?.totalAmount)
  ) {
    if (booking?.totalAmount) {
      return `This booking's total is ${money(booking.totalAmount, booking.currency)}.`;
    }
    return `This listing is priced at ${money(listing.pricePerNight, listing.currency)} per night.`;
  }
  if (/includ/.test(question) && amenities) {
    return amenities.length
      ? `Included amenities: ${amenities.join(', ')}.`
      : "I don't see any amenities listed for this yet.";
  }
  return "I don't have that information in what's been shared with me for this conversation yet.";
}

function composeRecommendationBlurb(context) {
  const { category, city, reason, typicalBudget } = context;
  const budgetSuffix = typicalBudget
    ? ` — picked close to the ${typicalBudget} you typically spend.`
    : '';
  if (reason === 'past_booking') {
    return `Because you booked a similar ${category ?? 'listing'} before, you might enjoy this one in ${city ?? 'the same area'}.${budgetSuffix}`;
  }
  if (reason === 'favorite') {
    return `Similar to listings you've favorited in ${city ?? 'this destination'}.${budgetSuffix}`;
  }
  return `Popular with travelers interested in ${category ?? 'this kind of trip'}.${budgetSuffix}`;
}

function composeListingDescription(context) {
  const { title, category, city, amenities = [], attributes = {} } = context;
  const amenityPhrase = amenities.length
    ? ` Guests will find ${amenities.slice(0, 5).join(', ')}.`
    : '';
  const attributePhrase = Object.entries(attributes)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return `${title ?? 'This listing'} is a ${category ?? 'property'} located in ${
    city ?? 'Armenia'
  }.${amenityPhrase}${attributePhrase ? ` Details: ${attributePhrase}.` : ''}`;
}

function composeListingSeo(context) {
  const { title, city, category } = context;
  return JSON.stringify({
    metaTitle: `${title ?? 'Listing'} in ${city ?? 'Armenia'} | desavii`,
    metaDescription: `Book ${title ?? `this ${category ?? 'listing'}`} in ${
      city ?? 'Armenia'
    } on desavii — real availability, transparent pricing.`,
  });
}

function composeListingTitle(context) {
  const { category, city, keyFeature } = context;
  return [category, keyFeature, city && `in ${city}`].filter(Boolean).join(' ');
}

function composeListingAmenities(context) {
  const { category = '' } = context;
  const SUGGESTIONS = {
    hotel: [
      'Free Wi-Fi',
      'Air conditioning',
      '24/7 front desk',
      'Daily housekeeping',
    ],
    apartment: ['Free Wi-Fi', 'Kitchen', 'Washer', 'Air conditioning'],
    tour: ['English-speaking guide', 'Transport included', 'Bottled water'],
  };
  const key = Object.keys(SUGGESTIONS).find((k) =>
    category.toLowerCase().includes(k),
  );
  return JSON.stringify({
    suggestedAmenities: key ? SUGGESTIONS[key] : ['Free Wi-Fi'],
  });
}

function composeListingTranslate(context) {
  const { text, targetLanguageCode } = context;
  // Honest limitation: without a real provider key, this is NOT a
  // translation — it is clearly labeled as untranslated, never a fake
  // machine-translated string presented as real.
  return `[untranslated — no AI translation provider configured for ${targetLanguageCode ?? 'this language'}] ${text ?? ''}`;
}

function composeListingFaqs(context) {
  const { policies = {}, amenities = [] } = context;
  const faqs = [];
  if (policies.cancellation) {
    faqs.push({
      question: 'What is the cancellation policy?',
      answer: policies.cancellation,
    });
  }
  if (amenities.length) {
    faqs.push({
      question: 'What amenities are included?',
      answer: amenities.join(', '),
    });
  }
  if (faqs.length === 0) {
    faqs.push({
      question: 'Where can I find more details?',
      answer: 'Please contact the host directly through the messaging feature.',
    });
  }
  return JSON.stringify({ faqs });
}

function composeModeration(context) {
  const { heuristicScore = 0, signals = [] } = context;
  if (signals.length === 0) {
    return `Heuristic score ${heuristicScore}/100 with no named signals — likely does not need manual review. AI-enhanced classification unavailable (no provider key configured); this heuristic score stands alone.`;
  }
  return `Heuristic score ${heuristicScore}/100 with signals: ${signals.join(', ')} — likely needs manual review. AI-enhanced classification unavailable (no provider key configured); this heuristic score stands alone.`;
}

const COMPOSERS = {
  [FEATURE_CODES.TRIP_PLANNER]: (context) => composeTripPlanner(context),
  [FEATURE_CODES.SEARCH_PARSE]: (context) => composeSearchParse(context),
  [FEATURE_CODES.RECOMMENDATIONS]: (context) =>
    composeRecommendationBlurb(context),
  [FEATURE_CODES.LISTING_DESCRIPTION]: (context) =>
    composeListingDescription(context),
  [FEATURE_CODES.LISTING_SEO]: (context) => composeListingSeo(context),
  [FEATURE_CODES.LISTING_TITLE]: (context) => composeListingTitle(context),
  [FEATURE_CODES.LISTING_AMENITIES]: (context) =>
    composeListingAmenities(context),
  [FEATURE_CODES.LISTING_TRANSLATE]: (context) =>
    composeListingTranslate(context),
  [FEATURE_CODES.LISTING_FAQS]: (context) => composeListingFaqs(context),
  [FEATURE_CODES.MODERATION]: (context) => composeModeration(context),
};

export class LocalHeuristicProvider extends AIProvider {
  // eslint-disable-next-line class-methods-use-this
  get code() {
    return 'local';
  }

  // eslint-disable-next-line class-methods-use-this
  async complete({ messages }) {
    const systemMessage = messages.find((message) => message.role === 'system');
    const userMessages = messages.filter((message) => message.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];
    const featureCode = extractFeatureCode(systemMessage?.content);
    const context = extractContext(lastUserMessage?.content);

    let content;
    if (featureCode === FEATURE_CODES.ASSISTANT) {
      content = composeAssistant(context, lastUserMessage?.content);
    } else if (featureCode && COMPOSERS[featureCode]) {
      content = COMPOSERS[featureCode](context);
    } else {
      content =
        "I don't have enough grounded context to answer this yet — please try again once more information is available.";
    }

    return {
      content,
      model: MODEL_NAME,
      usage: {
        promptTokens: estimateTokens(messages.map((m) => m.content).join(' ')),
        completionTokens: estimateTokens(content),
      },
    };
  }

  async *stream(request) {
    const { content, model, usage } = await this.complete(request);
    const words = content.split(/(\s+)/);
    for (const word of words) {
      // eslint-disable-next-line no-await-in-loop -- deliberate: simulates real token-by-token pacing
      await new Promise((resolve) => {
        setTimeout(resolve, 15);
      });
      yield { delta: word, done: false };
    }
    yield { delta: '', done: true, model, usage };
  }
}

export default LocalHeuristicProvider;
