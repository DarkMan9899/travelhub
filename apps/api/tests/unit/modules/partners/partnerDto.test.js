/**
 * Phase 10 (redesign): unit coverage for the two new public Partner DTO
 * mappings — pure functions, no database needed, mirroring
 * `tests/unit/modules/listings/listingDto.test.js`'s convention.
 */

import { describe, test, expect } from '@jest/globals';
import {
  toPartnerSummaryResponse,
  toPartnerDetailResponse,
} from '../../../../src/modules/partners/dto/partnerDto.js';

const SUMMARY_DOMAIN = {
  id: 1,
  slug: 'yerevan-boutique-hospitality',
  displayName: 'Yerevan Boutique Hospitality',
  description: 'A boutique hospitality partner.',
  logoUrl: 'https://cdn.example/logo.png',
  coverUrl: null,
  listingCount: 4,
  isVerified: true,
};

describe('toPartnerSummaryResponse', () => {
  test('maps the domain shape to the public response shape', () => {
    expect(toPartnerSummaryResponse(SUMMARY_DOMAIN)).toEqual({
      id: 1,
      slug: 'yerevan-boutique-hospitality',
      display_name: 'Yerevan Boutique Hospitality',
      description: 'A boutique hospitality partner.',
      logo_url: 'https://cdn.example/logo.png',
      cover_url: null,
      listing_count: 4,
      is_verified: true,
    });
  });
});

describe('toPartnerDetailResponse', () => {
  test('extends the summary shape with contact fields', () => {
    const response = toPartnerDetailResponse({
      ...SUMMARY_DOMAIN,
      email: 'hello@example.com',
      phone: '+37411000000',
      website: 'https://example.com',
      socialLinks: { instagram: 'https://instagram.com/example' },
    });

    expect(response).toEqual({
      id: 1,
      slug: 'yerevan-boutique-hospitality',
      display_name: 'Yerevan Boutique Hospitality',
      description: 'A boutique hospitality partner.',
      logo_url: 'https://cdn.example/logo.png',
      cover_url: null,
      listing_count: 4,
      is_verified: true,
      email: 'hello@example.com',
      phone: '+37411000000',
      website: 'https://example.com',
      social_links: { instagram: 'https://instagram.com/example' },
    });
  });
});
