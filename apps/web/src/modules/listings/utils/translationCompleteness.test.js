import { describe, test, expect } from 'vitest';
import computeTranslationCompleteness, {
  TOTAL_FIELDS,
} from './translationCompleteness.js';

function listingFixture(overrides = {}) {
  return {
    translations: [],
    highlights: [],
    included_items: [],
    faqs: [],
    itinerary_steps: [],
    ...overrides,
  };
}

describe('computeTranslationCompleteness (apps/web/src/modules/listings)', () => {
  test('a locale with nothing stored at all is "missing"', () => {
    const listing = listingFixture();
    const result = computeTranslationCompleteness(listing, 'hy');
    expect(result.status).toBe('missing');
    expect(result.presentCount).toBe(0);
    expect(result.totalFields).toBe(TOTAL_FIELDS);
  });

  test('a locale with every field authored is "complete"', () => {
    const listing = listingFixture({
      translations: [
        {
          language_code: 'en',
          title: 'Title',
          summary: 'Summary',
          description: 'Description',
        },
      ],
      highlights: [{ language_code: 'en', text: 'Highlight' }],
      included_items: [{ language_code: 'en', item_text: 'Item' }],
      faqs: [{ language_code: 'en', question: 'Q', answer: 'A' }],
      itinerary_steps: [{ language_code: 'en', title: 'Step' }],
    });
    const result = computeTranslationCompleteness(listing, 'en');
    expect(result.status).toBe('complete');
    expect(result.presentCount).toBe(TOTAL_FIELDS);
  });

  test('a locale with only a title is "partial", not "complete"', () => {
    const listing = listingFixture({
      translations: [{ language_code: 'hy', title: 'Վերնագիր' }],
    });
    const result = computeTranslationCompleteness(listing, 'hy');
    expect(result.status).toBe('partial');
    expect(result.presentCount).toBe(1);
    expect(result.checks.title).toBe(true);
    expect(result.checks.summary).toBe(false);
  });

  test('a whitespace-only title does not count as present', () => {
    const listing = listingFixture({
      translations: [{ language_code: 'ru', title: '   ' }],
    });
    const result = computeTranslationCompleteness(listing, 'ru');
    expect(result.checks.title).toBe(false);
    expect(result.status).toBe('missing');
  });

  test("never borrows another locale's content — en-only data reads as missing for hy", () => {
    const listing = listingFixture({
      translations: [{ language_code: 'en', title: 'English title' }],
      highlights: [{ language_code: 'en', text: 'English highlight' }],
    });
    const result = computeTranslationCompleteness(listing, 'hy');
    expect(result.status).toBe('missing');
    expect(result.presentCount).toBe(0);
  });

  test('itinerary presence is tracked independently of the other rich-content fields', () => {
    const listing = listingFixture({
      translations: [{ language_code: 'en', title: 'Tour title' }],
      itinerary_steps: [{ language_code: 'en', title: 'Day 1' }],
    });
    const result = computeTranslationCompleteness(listing, 'en');
    expect(result.checks.itinerary).toBe(true);
    expect(result.checks.highlights).toBe(false);
    expect(result.presentCount).toBe(2);
  });
});
