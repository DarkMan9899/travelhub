/**
 * Phase 18 (Premium Listing Detail Experience) — the new partner-authored
 * structured content endpoints (highlights / itinerary / included-items /
 * FAQs, all full-replace PATCH), the media caption/alt-text write, and
 * the non-throwing listing-completeness endpoint. Mirrors
 * `listingCrud.test.js`'s exact real-listing setup (vendor@travelhub.dev
 * owns the verified `yerevan-boutique-hospitality` partner).
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { up } from '../../../src/infrastructure/database/migrate.js';
import { seedAll } from '../../../src/infrastructure/database/seeds/index.js';
import app from '../../../src/app.js';
import {
  getMysqlPool,
  closeMysqlPool,
} from '../../../src/infrastructure/database/mysqlPool.js';
import { closeRedisConnection } from '../../../src/infrastructure/cache/redisClient.js';
import { resetRateLimits } from '../helpers/resetRateLimits.js';
import { DEV_CREDENTIALS } from '../../../src/infrastructure/database/seeds/005_dev_accounts.js';

const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

let pool;
let vendor;
let customer;
let partnerId;
let languageId;
let categoryId;
let listingId;

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return { accessToken: res.body.data.access_token };
}

beforeAll(async () => {
  await up();
  await seedAll();
  await resetRateLimits();
  pool = getMysqlPool();

  vendor = await login(
    DEV_CREDENTIALS.vendor.email,
    DEV_CREDENTIALS.vendor.password,
  );
  customer = await login(
    DEV_CREDENTIALS.customer.email,
    DEV_CREDENTIALS.customer.password,
  );

  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;
  const [[category]] = await pool.query(
    "SELECT id FROM listing_categories WHERE slug = 'hotels'",
  );
  categoryId = category.id;

  const createRes = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType: 'HOTEL',
      translations: [
        {
          languageId,
          title: `Rich Content Test ${Date.now()}`,
          summary: 'A test listing for Phase 18 rich content.',
        },
      ],
      categoryIds: [categoryId],
    });
  listingId = createRes.body.data.id;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('PATCH /listings/:id/highlights', () => {
  test('owner can replace the highlights list', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        highlights: [
          { iconCode: 'mountain', text: 'Best mountain view' },
          { iconCode: 'clock', text: 'Free cancellation' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({
      icon_code: 'mountain',
      text: 'Best mountain view',
    });
  });

  test('a second replace fully overwrites the first (order preserved)', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ highlights: [{ iconCode: 'wifi', text: 'Free WiFi' }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].text).toBe('Free WiFi');
  });

  test('a non-owner cannot replace highlights', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({ highlights: [{ iconCode: 'x', text: 'nope' }] });
    expect(res.status).toBe(403);
  });

  test('rejects a malformed highlight entry', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({ highlights: [{ iconCode: '', text: 'nope' }] });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /listings/:id/itinerary', () => {
  test('owner can replace the itinerary steps in order', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/itinerary`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        steps: [
          { title: 'Meet at the hotel lobby', durationMinutes: 15 },
          {
            title: 'Depart for the trailhead',
            description: 'A 30-minute drive.',
            durationMinutes: 30,
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].title).toBe('Meet at the hotel lobby');
    expect(res.body.data[1].duration_minutes).toBe(30);
  });
});

describe('PATCH /listings/:id/included-items', () => {
  test('owner can replace included/not-included items', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/included-items`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        items: [
          { itemText: 'Breakfast', isIncluded: true },
          { itemText: 'Airport transfer', isIncluded: false },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const included = res.body.data.find((i) => i.item_text === 'Breakfast');
    expect(included.is_included).toBe(true);
    const notIncluded = res.body.data.find(
      (i) => i.item_text === 'Airport transfer',
    );
    expect(notIncluded.is_included).toBe(false);
  });
});

describe('PATCH /listings/:id/faqs', () => {
  test('owner can replace the FAQ list', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/faqs`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        faqs: [
          {
            question: 'Is parking available?',
            answer: 'Yes, free on-site parking.',
          },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].question).toBe('Is parking available?');
  });
});

describe('GET /listings/:id — rich content round-trips through the read DTO', () => {
  test('highlights/itinerary/included_items/faqs all appear on the full listing response', async () => {
    // The listing is still a DRAFT at this point in the suite — `getListing`
    // 404-masks drafts for non-owners, so this must be an authenticated
    // owner request, not a public one.
    const res = await request(app)
      .get(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.highlights).toEqual([
      {
        id: expect.any(Number),
        language_code: 'en',
        icon_code: 'wifi',
        text: 'Free WiFi',
      },
    ]);
    expect(res.body.data.itinerary_steps).toHaveLength(2);
    expect(res.body.data.included_items).toHaveLength(2);
    expect(res.body.data.faqs).toHaveLength(1);
  });
});

describe('2026 Partner Workspace redesign (Sprint 3): rich content writes are per-language via the real endpoint', () => {
  // Traced end-to-end before building the Sprint 3 UI on top of this:
  // every replace-* repository method's DELETE is scoped by
  // `listing_id AND language_id`, so a write was already destructive
  // ONLY within its own locale — but until this sprint, `languageCode`
  // wasn't threaded through from the request at all, so 'hy'/'ru' were
  // never actually reachable via the API (only a direct SQL insert, as
  // this file used to do). These tests exercise the now-real
  // `languageCode` body field through the live HTTP endpoint, not a raw
  // SQL shortcut, to prove the whole path — validator → controller →
  // service → repository — honors it correctly.

  test('writing highlights with languageCode: "hy" creates hy-only rows, leaving the existing en rows untouched', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        languageCode: 'hy',
        highlights: [{ iconCode: 'wifi', text: 'Անվճար Wi-Fi' }],
      });
    expect(res.status).toBe(200);
    // The response mirrors the read side and returns every language's
    // current rows, so the pre-existing 'en' row (from the earlier
    // "second replace fully overwrites the first" test, text 'Free WiFi')
    // must still be present alongside the new 'hy' one.
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language_code: 'en', text: 'Free WiFi' }),
        expect.objectContaining({ language_code: 'hy', text: 'Անվճար Wi-Fi' }),
      ]),
    );
    expect(res.body.data).toHaveLength(2);
  });

  test('a second hy-scoped replace only touches the hy rows, leaving en intact', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        languageCode: 'hy',
        highlights: [{ iconCode: 'wifi', text: 'Անվճար Wi-Fi, թարմացված' }],
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language_code: 'en', text: 'Free WiFi' }),
        expect.objectContaining({
          language_code: 'hy',
          text: 'Անվճար Wi-Fi, թարմացված',
        }),
      ]),
    );
    expect(res.body.data).toHaveLength(2);
  });

  test('a write with no languageCode still defaults to the platform default (en), for backward compatibility', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        highlights: [{ iconCode: 'wifi', text: 'Free WiFi, no-code write' }],
      });
    expect(res.status).toBe(200);
    // The 'en' row is the one that changed; 'hy' (from the prior test)
    // must be completely unaffected by an omitted languageCode.
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          language_code: 'en',
          text: 'Free WiFi, no-code write',
        }),
        expect.objectContaining({
          language_code: 'hy',
          text: 'Անվճար Wi-Fi, թարմացված',
        }),
      ]),
    );
  });

  test('itinerary/included-items/faqs all honor languageCode the same way', async () => {
    const itineraryRes = await request(app)
      .patch(`/api/v1/listings/${listingId}/itinerary`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        languageCode: 'ru',
        steps: [{ title: 'Встреча в лобби отеля', durationMinutes: 15 }],
      });
    expect(itineraryRes.status).toBe(200);
    expect(itineraryRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language_code: 'en' }),
        expect.objectContaining({
          language_code: 'ru',
          title: 'Встреча в лобби отеля',
        }),
      ]),
    );

    const includedRes = await request(app)
      .patch(`/api/v1/listings/${listingId}/included-items`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        languageCode: 'ru',
        items: [{ itemText: 'Завтрак', isIncluded: true }],
      });
    expect(includedRes.status).toBe(200);
    expect(includedRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language_code: 'en' }),
        expect.objectContaining({ language_code: 'ru', item_text: 'Завтрак' }),
      ]),
    );

    const faqsRes = await request(app)
      .patch(`/api/v1/listings/${listingId}/faqs`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        languageCode: 'ru',
        faqs: [
          { question: 'Есть парковка?', answer: 'Да, бесплатная парковка.' },
        ],
      });
    expect(faqsRes.status).toBe(200);
    expect(faqsRes.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language_code: 'en' }),
        expect.objectContaining({
          language_code: 'ru',
          question: 'Есть парковка?',
        }),
      ]),
    );

    const getRes = await request(app)
      .get(`/api/v1/listings/${listingId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(getRes.status).toBe(200);
    // Full round-trip: 'en', 'hy' (highlights only), and 'ru' rows all
    // coexist on the same listing across all four collections.
    expect(
      getRes.body.data.highlights.map((h) => h.language_code).sort(),
    ).toEqual(['en', 'hy']);
    // Two 'en' rows here is correct, not a bug in the app: the earlier
    // "owner can replace the itinerary steps in order" test in this file
    // already left 2 unrelated 'en' steps on this same listing — this
    // ru-scoped write must add its own row alongside them, not touch or
    // collapse them.
    expect(
      getRes.body.data.itinerary_steps.map((s) => s.language_code),
    ).toEqual(['en', 'en', 'ru']);
    // Two 'en' rows here too — "owner can replace included/not-included
    // items" earlier in this file left 2 'en' items (Breakfast, Airport
    // transfer) on this same listing.
    expect(getRes.body.data.included_items.map((i) => i.language_code)).toEqual(
      ['en', 'en', 'ru'],
    );
    expect(getRes.body.data.faqs.map((f) => f.language_code)).toEqual([
      'en',
      'ru',
    ]);
  });

  test('an invalid languageCode is rejected by validation, not silently coerced to the default', async () => {
    const res = await request(app)
      .patch(`/api/v1/listings/${listingId}/highlights`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        languageCode: 'fr',
        highlights: [{ iconCode: 'wifi', text: 'nope' }],
      });
    expect(res.status).toBe(422);
  });
});

describe('PATCH /listings/:id/media/:mediaId — caption/alt text', () => {
  test('owner can set alt text and caption on an uploaded image', async () => {
    const uploadRes = await request(app)
      .post(`/api/v1/listings/${listingId}/media`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .set('Content-Type', 'image/png')
      .send(ONE_PX_PNG);
    expect(uploadRes.status).toBe(201);
    const mediaId = uploadRes.body.data.id;

    const updateRes = await request(app)
      .patch(`/api/v1/listings/${listingId}/media/${mediaId}`)
      .set('Authorization', `Bearer ${vendor.accessToken}`)
      .send({
        altText: 'Hotel exterior at sunset',
        caption: 'Our boutique hotel in the evening light',
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.alt_text).toBe('Hotel exterior at sunset');
    expect(updateRes.body.data.caption).toBe(
      'Our boutique hotel in the evening light',
    );
  });
});

describe('GET /listings/:id/completeness', () => {
  test('a listing missing required fields reports isPublishReady=false with a real percentage', async () => {
    const res = await request(app)
      .get(`/api/v1/listings/${listingId}/completeness`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_publish_ready).toBe(false);
    // `media` is intentionally not asserted here — an earlier test in this
    // file already uploaded an image to this same listing, so by this
    // point in the suite it's genuinely no longer missing. `location` and
    // `bookableUnits` are never satisfied anywhere in this file.
    expect(res.body.data.required_missing).toEqual(
      expect.arrayContaining(['location', 'bookableUnits']),
    );
    expect(res.body.data.percent_complete).toBeGreaterThanOrEqual(0);
    expect(res.body.data.percent_complete).toBeLessThan(100);
  });

  test('recommended-only gaps never block publish-readiness reporting', async () => {
    const res = await request(app)
      .get(`/api/v1/listings/${listingId}/completeness`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    // highlights/faqs were already populated above by the earlier tests,
    // so they should not still be flagged as recommended gaps.
    expect(res.body.data.recommended_missing).not.toContain('highlights');
    expect(res.body.data.recommended_missing).not.toContain('faqs');
  });

  test('a non-owner cannot view completeness', async () => {
    const res = await request(app)
      .get(`/api/v1/listings/${listingId}/completeness`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(403);
  });
});
