/**
 * Sprint 8: "Public listing search, Owner search, Admin search."
 * Exercises keyword/category/type/city/country/status/partner filtering,
 * cursor pagination, sorting, and the visibility rule (published-only for
 * the public, drafts visible to the owning partner or to `listing.moderate`
 * holders) against the real seeded data — mirrors
 * `tests/integration/listings/listingCrud.test.js`'s structure, reusing
 * the Listings API (`POST /listings`, publish flow) to create fixtures
 * rather than hand-crafting rows, so this suite never duplicates Listings'
 * own business logic.
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
let admin;
let partnerId;
let languageId;
let hotelsCategoryId;
let apartmentsCategoryId;
let yerevanCityId;
let gyumriCityId;
let armeniaCountryId;

let listingBoutique; // published, HOTEL, hotels category, Yerevan
let listingCozy; // published, PROPERTY, apartments category, Yerevan
let listingGyumri; // published, PROPERTY, hotels category, Gyumri
let listingDraft; // never published

async function login(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });
  return {
    accessToken: res.body.data.access_token,
    userId: res.body.data.user.id,
  };
}

async function createListing({ title, listingType, categoryId, cityId }) {
  const res = await request(app)
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      partnerId,
      listingType,
      translations: [
        {
          languageId,
          title,
          description: `${title} — a lovely place to stay.`,
        },
      ],
      categoryIds: [categoryId],
      location: { cityId },
    });
  return res.body.data.id;
}

async function publishListing(listingId) {
  await request(app)
    .patch(`/api/v1/listings/${listingId}`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({
      location: { latitude: 40.18, longitude: 44.5 },
      // Phase 5: hotels/apartments both have required policies
      // (seeds/007_pricing_and_policies.js) — satisfied here so this
      // file's publish calls keep succeeding under the new gate.
      policyValues: [
        { code: 'cancellation_policy', value: 'FLEXIBLE' },
        { code: 'check_in_time', value: '14:00' },
        { code: 'check_out_time', value: '11:00' },
      ],
    });
  await request(app)
    .post(`/api/v1/listings/${listingId}/media`)
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .set('Content-Type', 'image/png')
    .send(ONE_PX_PNG);
  // Phase 5: publish now also requires >=1 bookable unit.
  await request(app)
    .post('/api/v1/availability/units')
    .set('Authorization', `Bearer ${vendor.accessToken}`)
    .send({ listingId, bookableUnitType: 'HOTEL_ROOM' });
  await request(app)
    .post(`/api/v1/listings/${listingId}/publish`)
    .set('Authorization', `Bearer ${vendor.accessToken}`);
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
  admin = await login(
    DEV_CREDENTIALS.admin.email,
    DEV_CREDENTIALS.admin.password,
  );

  const [[partnerRow]] = await pool.query(
    "SELECT id FROM partners WHERE slug = 'yerevan-boutique-hospitality'",
  );
  partnerId = partnerRow.id;
  const [[language]] = await pool.query(
    "SELECT id FROM languages WHERE code = 'en'",
  );
  languageId = language.id;
  const [[hotelsCategory]] = await pool.query(
    "SELECT id FROM listing_categories WHERE slug = 'hotels'",
  );
  hotelsCategoryId = hotelsCategory.id;
  const [[apartmentsCategory]] = await pool.query(
    "SELECT id FROM listing_categories WHERE slug = 'apartments'",
  );
  apartmentsCategoryId = apartmentsCategory.id;
  const [[yerevan]] = await pool.query(
    "SELECT id FROM cities WHERE slug = 'yerevan'",
  );
  yerevanCityId = yerevan.id;
  const [[gyumri]] = await pool.query(
    "SELECT id FROM cities WHERE slug = 'gyumri'",
  );
  gyumriCityId = gyumri.id;
  const [[armenia]] = await pool.query(
    "SELECT id FROM countries WHERE iso_code = 'AM'",
  );
  armeniaCountryId = armenia.id;

  const boutiqueId = await createListing({
    title: 'Boutique Yerevan Hotel',
    listingType: 'HOTEL',
    categoryId: hotelsCategoryId,
    cityId: yerevanCityId,
  });
  const cozyId = await createListing({
    title: 'Cozy Apartment Downtown',
    listingType: 'PROPERTY',
    categoryId: apartmentsCategoryId,
    cityId: yerevanCityId,
  });
  const gyumriId = await createListing({
    title: 'Gyumri Fortress View',
    listingType: 'PROPERTY',
    categoryId: hotelsCategoryId,
    cityId: gyumriCityId,
  });
  listingDraft = await createListing({
    title: 'Draft Only Listing',
    listingType: 'HOTEL',
    categoryId: hotelsCategoryId,
    cityId: yerevanCityId,
  });

  await Promise.all([
    publishListing(boutiqueId),
    publishListing(cozyId),
    publishListing(gyumriId),
  ]);

  listingBoutique = boutiqueId;
  listingCozy = cozyId;
  listingGyumri = gyumriId;
}, 60_000);

afterAll(async () => {
  await closeMysqlPool();
  await closeRedisConnection();
});

describe('GET /search/listings — filtering', () => {
  test('keyword matches title/description via FULLTEXT', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?keyword=Boutique',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toEqual([listingBoutique]);
  });

  // Phase 10 (redesign): `media_count`/`price_amount`/`price_currency_code`
  // are additive fields the enriched listing card needs. This suite's
  // fixtures attach exactly one media file during publish and never set
  // pricing — so a real, non-zero media_count and an honest `null` price
  // (no pricing row exists) prove both are wired correctly, not just
  // present-but-unused in the DTO.
  test('rows carry media_count and an honest null price when no pricing is set', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?keyword=Boutique',
    );
    expect(res.status).toBe(200);
    expect(res.body.data[0]).toEqual(
      expect.objectContaining({
        media_count: 1,
        price_amount: null,
        price_currency_code: null,
      }),
    );
  });

  test('category filter narrows to that category', async () => {
    const res = await request(app).get(
      `/api/v1/search/listings?categoryId=${hotelsCategoryId}`,
    );
    expect(res.status).toBe(200);
    // categoryId is a broad, shared fixture category — other integration
    // suites in this shared-DB run (e.g. listingCrud.test.js) also publish
    // hotels-category listings, so assert containment, not an exact set.
    const ids = res.body.data.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([listingBoutique, listingGyumri]),
    );
  });

  test('listing type filter narrows to that type', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?listingType=PROPERTY',
    );
    expect(res.status).toBe(200);
    // listingType is shared across suites (e.g. listingWizardFlow.test.js
    // also publishes a PROPERTY listing) — assert containment, not an
    // exact set.
    const ids = res.body.data.map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([listingCozy, listingGyumri]));
  });

  test('city filter narrows to that city', async () => {
    const res = await request(app).get(
      `/api/v1/search/listings?cityId=${gyumriCityId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toEqual([listingGyumri]);
  });

  test('country filter includes every listing in that country', async () => {
    const res = await request(app).get(
      `/api/v1/search/listings?countryId=${armeniaCountryId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });

  test('an unknown listingType/category/city returns an empty result, not an error', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?listingType=SPACESHIP',
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /search/listings — visibility', () => {
  test('the public never sees a draft, even when explicitly requesting it', async () => {
    const res = await request(app).get('/api/v1/search/listings?status=DRAFT');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).not.toContain(listingDraft);
    expect(res.body.data.map((r) => r.status)).toEqual(
      res.body.data.map(() => 'PUBLISHED'),
    );
  });

  test('the owning partner sees its own draft via partnerId + status', async () => {
    const res = await request(app)
      .get(`/api/v1/search/listings?partnerId=${partnerId}&status=DRAFT`)
      .set('Authorization', `Bearer ${vendor.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toContain(listingDraft);
  });

  test('a customer (no permission) cannot see the draft even with partnerId', async () => {
    const res = await request(app)
      .get(`/api/v1/search/listings?partnerId=${partnerId}&status=DRAFT`)
      .set('Authorization', `Bearer ${customer.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).not.toContain(listingDraft);
  });

  test('an admin (listing.moderate) sees the draft platform-wide, no partnerId needed', async () => {
    const res = await request(app)
      .get('/api/v1/search/listings?status=DRAFT')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toContain(listingDraft);
  });
});

describe('GET /search/listings — sorting and cursor pagination', () => {
  test('alphabetical sort paginates correctly across two pages via the composite cursor', async () => {
    // Scoped with `keyword` (matching this file's own distinctive fixture
    // description text, "a lovely place to stay") so this assertion is
    // unaffected by other listings the full test suite's other files
    // create in the same shared database — an unfiltered query here
    // would otherwise see every published listing across the whole run,
    // not just these three.
    const page1 = await request(app).get(
      '/api/v1/search/listings?sort=alphabetical&limit=2&keyword=lovely',
    );
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.has_more).toBe(true);
    expect(page1.body.data.map((r) => r.id)).toEqual([
      listingBoutique,
      listingCozy,
    ]);

    const page2 = await request(app).get(
      `/api/v1/search/listings?sort=alphabetical&limit=2&keyword=lovely&cursor=${page1.body.meta.next_cursor}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.body.data.map((r) => r.id)).toEqual([listingGyumri]);
    expect(page2.body.meta.has_more).toBe(false);
  });

  test('newest (created_at) sort paginates correctly across two pages via the composite cursor', async () => {
    // Regression test for a real Phase 11 pre-flight finding: `created_at`
    // cursor values were bound back to MySQL as UTC-normalized strings,
    // which compare wrong against the column whenever the DB session's
    // `time_zone` isn't UTC (`SYSTEM` on a non-UTC host, easy to miss in
    // a Docker/CI MySQL that defaults to UTC) — every page after the
    // first silently came back empty. `alphabetical`'s `title`-sorted
    // cursor above never exercises this path at all, which is exactly
    // why it went unnoticed until a demo dataset large enough to need a
    // second page existed.
    const page1 = await request(app).get(
      '/api/v1/search/listings?sort=newest&limit=2&keyword=lovely',
    );
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(2);
    expect(page1.body.meta.has_more).toBe(true);

    const page2 = await request(app).get(
      `/api/v1/search/listings?sort=newest&limit=2&keyword=lovely&cursor=${page1.body.meta.next_cursor}`,
    );
    expect(page2.status).toBe(200);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.meta.has_more).toBe(false);

    const allIds = [...page1.body.data, ...page2.body.data].map((r) => r.id);
    expect(new Set(allIds)).toEqual(
      new Set([listingBoutique, listingCozy, listingGyumri]),
    );
  });

  test('a malformed cursor gracefully resolves to the first page, not a 500', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?sort=alphabetical&cursor=not-a-real-cursor',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  test('relevance falls back to newest when no keyword is supplied', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?sort=relevance',
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
  });
});

describe('GET /search/listings — validation', () => {
  test('an invalid status value is rejected with 422', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?status=NOT_A_STATUS',
    );
    expect(res.status).toBe(422);
  });

  test('an invalid sort value is rejected with 422', async () => {
    const res = await request(app).get(
      '/api/v1/search/listings?sort=popularity',
    );
    expect(res.status).toBe(422);
  });
});

describe('GET /search — alias for GET /search/listings', () => {
  test('returns the same shape as /search/listings', async () => {
    const res = await request(app).get('/api/v1/search?keyword=Boutique');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.id)).toEqual([listingBoutique]);
  });
});
