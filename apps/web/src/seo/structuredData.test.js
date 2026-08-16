import { describe, test, expect } from 'vitest';
import {
  buildOrganizationSchema,
  buildWebsiteSchema,
  buildBreadcrumbListSchema,
  buildListingSchema,
  buildFaqPageSchema,
} from './structuredData.js';
import { SITE_BRAND_NAME } from './seoConfig.js';
import { buildLocaleUrl } from './urls.js';

describe('buildOrganizationSchema', () => {
  test('uses the real brand name, never a placeholder', () => {
    const schema = buildOrganizationSchema();
    expect(schema['@type']).toBe('Organization');
    expect(schema.name).toBe(SITE_BRAND_NAME);
    expect(schema.url).toBe(buildLocaleUrl('hy', ''));
  });
});

describe('buildWebsiteSchema', () => {
  test('builds a locale-scoped SearchAction target', () => {
    const schema = buildWebsiteSchema('en');
    expect(schema['@type']).toBe('WebSite');
    expect(schema.url).toBe(buildLocaleUrl('en', ''));
    expect(schema.potentialAction.target.urlTemplate).toBe(
      `${buildLocaleUrl('en', 'search')}?destination={search_term_string}`,
    );
  });
});

describe('buildBreadcrumbListSchema', () => {
  test('maps label/href pairs to positioned ListItem entries', () => {
    const schema = buildBreadcrumbListSchema([
      { label: 'Home', href: 'https://example.test/en' },
      { label: 'Hotels', href: 'https://example.test/en/categories/hotels' },
    ]);

    expect(schema.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://example.test/en',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Hotels',
        item: 'https://example.test/en/categories/hotels',
      },
    ]);
  });
});

describe('buildFaqPageSchema', () => {
  test('returns null rather than fabricating an empty FAQ block', () => {
    expect(buildFaqPageSchema([])).toBeNull();
    expect(buildFaqPageSchema(undefined)).toBeNull();
  });

  test('maps real question/answer pairs', () => {
    const schema = buildFaqPageSchema([
      {
        question: 'Is breakfast included?',
        answer: 'Yes, for all room types.',
      },
    ]);
    expect(schema.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Is breakfast included?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes, for all room types.' },
      },
    ]);
  });
});

describe('buildListingSchema', () => {
  const baseListing = {
    title: 'Boutique Yerevan Hotel',
    slug: 'boutique-yerevan-hotel',
  };

  test('dispatches to the correct schema.org @type per category code', () => {
    expect(
      buildListingSchema({
        listing: baseListing,
        categoryCode: 'hotels',
        locale: 'en',
        path: 'en/listings/boutique-yerevan-hotel',
      })['@type'],
    ).toBe('Hotel');

    expect(
      buildListingSchema({
        listing: baseListing,
        categoryCode: 'tours',
        locale: 'en',
        path: 'en/listings/x',
      })['@type'],
    ).toBe('TouristTrip');
  });

  test('falls back to Product for an unmapped category code (e.g. car-rentals)', () => {
    const schema = buildListingSchema({
      listing: baseListing,
      categoryCode: 'car-rentals',
      locale: 'en',
      path: 'en/listings/x',
    });
    expect(schema['@type']).toBe('Product');
  });

  test('never fabricates description, image, address, geo, or rating when the source data has none', () => {
    const schema = buildListingSchema({
      listing: baseListing,
      categoryCode: 'hotels',
      locale: 'en',
      path: 'en/listings/x',
    });

    expect(schema).not.toHaveProperty('description');
    expect(schema).not.toHaveProperty('image');
    expect(schema).not.toHaveProperty('address');
    expect(schema).not.toHaveProperty('geo');
    expect(schema).not.toHaveProperty('aggregateRating');
    expect(schema).not.toHaveProperty('offers');
  });

  test('includes only real, present fields when the listing has them', () => {
    const listing = {
      title: 'Boutique Yerevan Hotel',
      description: 'A charming stay in the city center.',
      slug: 'boutique-yerevan-hotel',
      media: [
        { media_type: 'image', url: 'https://cdn.test/1.jpg' },
        { media_type: 'document', url: 'https://cdn.test/brochure.pdf' },
      ],
      location: {
        city_name: 'Yerevan',
        country_name: 'Armenia',
        latitude: 40.18,
        longitude: 44.51,
      },
      rating_average: 4.6,
      review_count: 12,
      pricing: { amount: 80, currency_code: 'USD' },
    };

    const schema = buildListingSchema({
      listing,
      categoryCode: 'hotels',
      locale: 'en',
      path: 'en/listings/boutique-yerevan-hotel',
    });

    expect(schema.description).toBe(listing.description);
    expect(schema.image).toEqual(['https://cdn.test/1.jpg']);
    expect(schema.address).toEqual({
      '@type': 'PostalAddress',
      addressLocality: 'Yerevan',
      addressCountry: 'Armenia',
    });
    expect(schema.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 40.18,
      longitude: 44.51,
    });
    expect(schema.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingValue: 4.6,
      reviewCount: 12,
    });
    expect(schema.offers).toEqual({
      '@type': 'Offer',
      price: 80,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      url: buildLocaleUrl('hy', 'listings/boutique-yerevan-hotel'),
    });
  });

  test('never includes offers for TouristAttraction, even with real pricing data', () => {
    const listing = {
      ...baseListing,
      pricing: { amount: 10, currency_code: 'USD' },
    };
    const schema = buildListingSchema({
      listing,
      categoryCode: 'attractions',
      locale: 'en',
      path: 'en/listings/x',
    });
    expect(schema['@type']).toBe('TouristAttraction');
    expect(schema).not.toHaveProperty('offers');
  });

  test('omits aggregateRating when only one of rating/count is present', () => {
    const schema = buildListingSchema({
      listing: { ...baseListing, rating_average: 4.5, review_count: 0 },
      categoryCode: 'hotels',
      locale: 'en',
      path: 'en/listings/x',
    });
    expect(schema).not.toHaveProperty('aggregateRating');
  });
});
