/**
 * Phase 17 demo inventory scenarios.
 *
 * `seedDemoMarketplace.js` seeds 5 demo-only partners, none of which is
 * the dev-credentials partner (`yerevan-boutique-hospitality`, owned by
 * `vendor@travelhub.dev` — created by `005_dev_accounts.js`, part of the
 * baseline `seedAll()`). That partner has zero listings/inventory, which
 * means logging in with the documented dev vendor credentials shows an
 * empty dashboard — useless for browsing the Inventory, Availability &
 * Connectivity Platform. This module gives that exact partner real,
 * deterministic inventory across every service type and every capacity
 * source the engine tracks (TravelHub booking, TravelHub hold, manual
 * block, external reservation, connector sync), so every Phase 17 UI
 * surface (search/listing-detail availability, checkout revalidation,
 * Partner Quick Block/External Reservation/Connections Center, Admin
 * Inventory) has something real to show under the documented dev login.
 *
 * Runs in the same seed-demo transaction, after `seedDemoMarketplace`
 * (reuses its 20 demo customers) — see `cli/seedDemo.js`. Uses plain
 * INSERTs against the shared `connection`, same convention (and same
 * reasoning) as `seedDemoMarketplace.js`'s own header comment.
 */

import { getIdByCode, getIdsByCode } from '../helpers.js';

// Mirrors `LEDGER_SOURCE_TYPES` from
// `modules/availability/services/availabilityService.js` — duplicated as
// plain string literals rather than imported, since the `boundaries`
// ESLint rule forbids `infrastructure` importing from `modules` (seeds
// only ever write raw SQL against the schema, never call into a Service).
const LEDGER_SOURCE_TYPES = Object.freeze({
  TRAVELHUB_HOLD: 'TRAVELHUB_HOLD',
  TRAVELHUB_BOOKING: 'TRAVELHUB_BOOKING',
  MANUAL_BLOCK: 'MANUAL_BLOCK',
  EXTERNAL_RESERVATION: 'EXTERNAL_RESERVATION',
  CONNECTOR_SYNC: 'CONNECTOR_SYNC',
  ADJUSTMENT: 'ADJUSTMENT',
});

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}
function toSqlDate(date) {
  return date.toISOString().slice(0, 10);
}
function toSqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function insertBookableUnit(
  connection,
  {
    listingId,
    bookableUnitTypeId,
    capacity,
    timeSlotStart = null,
    timeSlotEnd = null,
    unitLabel = null,
    ownerUserId,
  },
) {
  const [result] = await connection.query(
    `INSERT INTO bookable_units
      (listing_id, bookable_unit_type_id, source_table, source_id, capacity,
       time_slot_start, time_slot_end, unit_label, created_by, updated_by)
     VALUES (?, ?, 'listings', ?, ?, ?, ?, ?, ?, ?)`,
    [
      listingId,
      bookableUnitTypeId,
      listingId,
      capacity,
      timeSlotStart,
      timeSlotEnd,
      unitLabel,
      ownerUserId,
      ownerUserId,
    ],
  );
  return result.insertId;
}

/** Seeds one AVAILABLE calendar row per day (capacity == quantity_available) across the given window. */
async function seedCalendarWindow(
  connection,
  { unitId, capacity, from, days, availableStatusId },
) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push([
      unitId,
      toSqlDate(addDays(from, i)),
      availableStatusId,
      capacity,
    ]);
  }
  await connection.query(
    `INSERT INTO availability_calendar
      (bookable_unit_id, date, status_id, quantity_available) VALUES ?`,
    [rows],
  );
}

/** Marks specific dates BLOCKED (status only, quantity 0) — a guide/staff personal-unavailability pattern. */
async function markCalendarBlocked(
  connection,
  { unitId, dates, blockedStatusId },
) {
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const date of dates) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design, seed scripts are not hot paths
    await connection.query(
      'UPDATE availability_calendar SET status_id = ?, quantity_available = 0 WHERE bookable_unit_id = ? AND date = ?',
      [blockedStatusId, unitId, toSqlDate(date)],
    );
  }
}

/** Decrements quantity_available across [from, to] and writes one inventory_ledger row per date — mirrors AvailabilityService's own reserve/block/external-reservation write path. */
async function decrementCalendar(
  connection,
  { unitId, from, to, amount, sourceType, sourceId, actorUserId, reason },
) {
  let cursor = new Date(from);
  const end = new Date(to);
  while (cursor <= end) {
    const dateStr = toSqlDate(cursor);
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const [[row]] = await connection.query(
      'SELECT quantity_available FROM availability_calendar WHERE bookable_unit_id = ? AND date = ?',
      [unitId, dateStr],
    );
    const before = row.quantity_available;
    const after = Math.max(before - amount, 0);
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await connection.query(
      'UPDATE availability_calendar SET quantity_available = ? WHERE bookable_unit_id = ? AND date = ?',
      [after, unitId, dateStr],
    );
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await connection.query(
      `INSERT INTO inventory_ledger
        (bookable_unit_id, date, source_type, source_id, delta, quantity_before, quantity_after, actor_user_id, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unitId,
        dateStr,
        sourceType,
        sourceId,
        -amount,
        before,
        after,
        actorUserId,
        reason,
      ],
    );
    cursor = addDays(cursor, 1);
  }
}

async function insertListing(
  connection,
  {
    partnerId,
    ownerUserId,
    listingTypeId,
    categoryId,
    citySlug,
    slug,
    title,
    summary,
    description,
    pricingModelId,
    amount,
    amdCurrencyId,
    enLanguageId,
    imageTypeId,
    completedUploadStatusId,
    approvedStatusId,
    publishedListingStatusId,
    now,
    imagePaths,
  },
) {
  const [[cityRow]] = await connection.query(
    'SELECT id FROM cities WHERE slug = ?',
    [citySlug],
  );
  const [listingResult] = await connection.query(
    `INSERT INTO listings
      (partner_id, listing_type_id, slug, status_id, moderation_status_id, published_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      partnerId,
      listingTypeId,
      slug,
      publishedListingStatusId,
      approvedStatusId,
      toSqlDateTime(addDays(now, -14)),
      ownerUserId,
      ownerUserId,
    ],
  );
  const listingId = listingResult.insertId;

  await connection.query(
    `INSERT INTO listing_translations (listing_id, language_id, title, summary, description)
     VALUES (?, ?, ?, ?, ?)`,
    [listingId, enLanguageId, title, summary, description],
  );
  await connection.query(
    `INSERT INTO listing_locations (listing_id, city_id, latitude, longitude)
     VALUES (?, ?, ?, ?)`,
    [listingId, cityRow.id, null, null],
  );
  await connection.query(
    'INSERT INTO listing_category_listing (listing_id, category_id) VALUES (?, ?)',
    [listingId, categoryId],
  );
  await connection.query(
    `INSERT INTO listing_pricing (listing_id, pricing_model_id, amount, currency_id)
     VALUES (?, ?, ?, ?)`,
    [listingId, pricingModelId, amount, amdCurrencyId],
  );

  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const [index, url] of imagePaths.entries()) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await connection.query(
      `INSERT INTO media
        (mediable_type, mediable_id, media_type_id, url, thumbnail_url, position, is_cover,
         upload_status_id, moderation_status_id, owner_user_id)
       VALUES ('listing', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        listingId,
        imageTypeId,
        url,
        url,
        index,
        index === 0 ? 1 : 0,
        completedUploadStatusId,
        approvedStatusId,
        ownerUserId,
      ],
    );
  }

  return listingId;
}

export default async function seedDemoInventoryScenarios(connection) {
  const [[partnerRow]] = await connection.query(
    `SELECT id AS partnerId, owner_user_id AS ownerUserId
     FROM partners WHERE slug = ?`,
    ['yerevan-boutique-hospitality'],
  );
  if (!partnerRow) {
    throw new Error(
      'seedDemoInventoryScenarios: dev vendor partner "yerevan-boutique-hospitality" not found — did seedAll() run first?',
    );
  }
  const { partnerId, ownerUserId } = partnerRow;

  const [customerRows] = await connection.query(
    `SELECT id, email, CONCAT(first_name, ' ', last_name) AS fullName
     FROM users WHERE email LIKE '%@example.com' ORDER BY id LIMIT 5`,
  );
  if (customerRows.length === 0) {
    throw new Error(
      'seedDemoInventoryScenarios must run after seedDemoMarketplace (no demo customers found).',
    );
  }
  const [customerA, customerB] = customerRows;

  const now = new Date();

  const [
    approvedStatusId,
    amdCurrencyId,
    enLanguageId,
    imageTypeId,
    completedUploadStatusId,
    publishedListingStatusId,
    availableStatusId,
    blockedStatusId,
    confirmedBookingStatusId,
    payAtPropertyStatusId,
  ] = await Promise.all([
    getIdByCode(connection, 'moderation_statuses', 'APPROVED'),
    getIdByCode(connection, 'currencies', 'AMD'),
    getIdByCode(connection, 'languages', 'en'),
    getIdByCode(connection, 'media_types', 'IMAGE'),
    getIdByCode(connection, 'media_upload_statuses', 'COMPLETED'),
    getIdByCode(connection, 'listing_statuses', 'PUBLISHED'),
    getIdByCode(connection, 'availability_statuses', 'AVAILABLE'),
    getIdByCode(connection, 'availability_statuses', 'BLOCKED'),
    getIdByCode(connection, 'booking_statuses', 'CONFIRMED'),
    getIdByCode(connection, 'payment_statuses', 'PAY_AT_PROPERTY'),
  ]);

  const listingTypeIds = await getIdsByCode(connection, 'listing_types', [
    'HOTEL',
    'PROPERTY',
    'TOUR',
    'CAR_RENTAL',
    'ATTRACTION',
  ]);
  const unitTypeIds = await getIdsByCode(connection, 'bookable_unit_types', [
    'HOTEL_ROOM',
    'PROPERTY_UNIT',
    'TOUR_DEPARTURE',
    'VEHICLE',
  ]);
  const pricingModelIds = await getIdsByCode(connection, 'pricing_models', [
    'PER_NIGHT',
    'PER_PERSON',
    'PER_DAY',
  ]);
  const bookingTypeIds = await getIdsByCode(connection, 'booking_types', [
    'HOTEL_ROOM_BOOKING',
  ]);

  const categoryIdBySlug = new Map();
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const slug of [
    'hotels',
    'apartments',
    'tours',
    'car-rentals',
    'attractions',
  ]) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const [[row]] = await connection.query(
      'SELECT id FROM listing_categories WHERE slug = ?',
      [slug],
    );
    categoryIdBySlug.set(slug, row.id);
  }

  const commonListingFields = {
    partnerId,
    ownerUserId,
    amdCurrencyId,
    enLanguageId,
    imageTypeId,
    completedUploadStatusId,
    approvedStatusId,
    publishedListingStatusId,
    now,
  };

  // === 1. Hotel — "Boutique Yerevan Hotel" (2 room types) =================
  const hotelListingId = await insertListing(connection, {
    ...commonListingFields,
    listingTypeId: listingTypeIds.get('HOTEL'),
    categoryId: categoryIdBySlug.get('hotels'),
    citySlug: 'yerevan',
    slug: 'demo-vendor-boutique-yerevan-hotel',
    title: 'Boutique Yerevan Hotel',
    summary:
      'A modern boutique hotel in central Yerevan with two distinct room types.',
    description:
      "Boutique Yerevan Hotel offers a calm, design-forward stay minutes from Republic Square, with Standard Rooms for solo travelers and Deluxe Suites for couples or business stays. Run by desavii's own demo vendor account, so every inventory source (bookings, holds, manual blocks, and phone reservations) is represented across its two room types.",
    pricingModelId: pricingModelIds.get('PER_NIGHT'),
    amount: 18500,
    imagePaths: [
      '/assets/images/demo/hotels/hotels-1.svg',
      '/assets/images/demo/hotels/hotels-2.svg',
    ],
  });

  const standardRoomId = await insertBookableUnit(connection, {
    listingId: hotelListingId,
    bookableUnitTypeId: unitTypeIds.get('HOTEL_ROOM'),
    capacity: 5,
    unitLabel: 'Standard Room',
    ownerUserId,
  });
  const deluxeSuiteId = await insertBookableUnit(connection, {
    listingId: hotelListingId,
    bookableUnitTypeId: unitTypeIds.get('HOTEL_ROOM'),
    capacity: 2,
    unitLabel: 'Deluxe Suite',
    ownerUserId,
  });

  await seedCalendarWindow(connection, {
    unitId: standardRoomId,
    capacity: 5,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });
  await seedCalendarWindow(connection, {
    unitId: deluxeSuiteId,
    capacity: 2,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });

  // Standard Room: a TravelHub booking (offset +6..+8).
  const bookingReference = `BK-${toSqlDate(now).replace(/-/g, '')}-DEMOVND01`;
  const [bookingResult] = await connection.query(
    `INSERT INTO bookings
      (booking_reference, customer_user_id, partner_id, listing_id, booking_type_id, status_id,
       guest_contact_snapshot, currency_id, subtotal_amount, fees_amount, discount_amount, total_amount,
       payment_method, payment_status_id, requested_at, confirmed_at, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 'offline', ?, ?, ?, ?, ?)`,
    [
      bookingReference,
      customerA.id,
      partnerId,
      hotelListingId,
      bookingTypeIds.get('HOTEL_ROOM_BOOKING'),
      confirmedBookingStatusId,
      JSON.stringify({
        fullName: customerA.fullName,
        email: customerA.email,
        phone: '+374 91 234567',
      }),
      amdCurrencyId,
      18500 * 2,
      18500 * 2,
      payAtPropertyStatusId,
      toSqlDateTime(addDays(now, -3)),
      toSqlDateTime(addDays(now, -2)),
      customerA.id,
      customerA.id,
    ],
  );
  const hotelBookingId = bookingResult.insertId;
  const [bookingItemResult] = await connection.query(
    `INSERT INTO booking_items (booking_id, bookable_unit_id, date_from, date_to, quantity, unit_price_amount)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [
      hotelBookingId,
      standardRoomId,
      toSqlDate(addDays(now, 6)),
      toSqlDate(addDays(now, 8)),
      18500,
    ],
  );
  await connection.query(
    'INSERT INTO booking_guests (booking_item_id, full_name) VALUES (?, ?)',
    [bookingItemResult.insertId, customerA.fullName],
  );
  await connection.query(
    `INSERT INTO booking_status_history (booking_id, from_status_id, to_status_id, changed_by)
     VALUES (?, NULL, ?, ?)`,
    [hotelBookingId, confirmedBookingStatusId, ownerUserId],
  );
  await decrementCalendar(connection, {
    unitId: standardRoomId,
    from: addDays(now, 6),
    to: addDays(now, 7),
    amount: 1,
    sourceType: LEDGER_SOURCE_TYPES.TRAVELHUB_BOOKING,
    sourceId: hotelBookingId,
    actorUserId: customerA.id,
    reason: `Booking ${bookingReference}`,
  });

  // Standard Room: a manual maintenance block (offset +2..+3) — flows A/B target.
  const [maintenanceBlockResult] = await connection.query(
    `INSERT INTO inventory_blocks
      (bookable_unit_id, date_from, date_to, quantity, reason_code, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      standardRoomId,
      toSqlDate(addDays(now, 2)),
      toSqlDate(addDays(now, 3)),
      5,
      'MAINTENANCE',
      'Bathroom renovation on the 2nd floor — demo manual block (unblock this to see it become bookable again).',
      ownerUserId,
    ],
  );
  // HOTEL_ROOM is an accommodation type (accommodationDateSemantics.js):
  // `date_to` is checkout, so only the check-in night (offset +2) is
  // actually consumed — decrementing through +3 as well would leave the
  // real `releaseManualBlock` restore (which correctly narrows to +2 only)
  // unable to fully undo this seeded decrement.
  await decrementCalendar(connection, {
    unitId: standardRoomId,
    from: addDays(now, 2),
    to: addDays(now, 2),
    amount: 5,
    sourceType: LEDGER_SOURCE_TYPES.MANUAL_BLOCK,
    sourceId: maintenanceBlockResult.insertId,
    actorUserId: ownerUserId,
    reason: 'Manual block: MAINTENANCE',
  });

  // Standard Room: "last room" date (offset +12) — flow D target.
  const [lastRoomReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, guest_phone, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      standardRoomId,
      toSqlDate(addDays(now, 12)),
      toSqlDate(addDays(now, 12)),
      4,
      'PHONE',
      'Anahit Sargsyan',
      '+374 93 445566',
      'Demo scenario: leaves exactly 1 room remaining on this date (flow D — stale-checkout rejection).',
      ownerUserId,
    ],
  );
  await decrementCalendar(connection, {
    unitId: standardRoomId,
    from: addDays(now, 12),
    to: addDays(now, 12),
    amount: 4,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: lastRoomReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: PHONE',
  });

  // Standard Room: fully sold-out date (offset +20).
  const [soldOutReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      standardRoomId,
      toSqlDate(addDays(now, 20)),
      toSqlDate(addDays(now, 20)),
      5,
      'WALK_IN',
      'Group booking (walk-in)',
      'Demo scenario: fully sold out on this date.',
      ownerUserId,
    ],
  );
  await decrementCalendar(connection, {
    unitId: standardRoomId,
    from: addDays(now, 20),
    to: addDays(now, 20),
    amount: 5,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: soldOutReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: WALK_IN',
  });

  // Deluxe Suite: an active TravelHub hold (offset +4..+5).
  const [holdResult] = await connection.query(
    `INSERT INTO reservation_holds (bookable_unit_id, user_id, start_date, end_date, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      deluxeSuiteId,
      customerB.id,
      toSqlDate(addDays(now, 4)),
      toSqlDate(addDays(now, 5)),
      // 3 hours from now — long enough to survive a demo browsing session
      // before the real expiry sweep reclaims it, matching real TTL behavior.
      new Date(now.getTime() + 3 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' '),
    ],
  );
  await decrementCalendar(connection, {
    unitId: deluxeSuiteId,
    from: addDays(now, 4),
    to: addDays(now, 4),
    amount: 1,
    sourceType: LEDGER_SOURCE_TYPES.TRAVELHUB_HOLD,
    sourceId: holdResult.insertId,
    actorUserId: customerB.id,
    reason: 'Active reservation hold',
  });

  // Deluxe Suite: a phone reservation recorded by the partner (offset +9..+10) — flow C baseline.
  const [phoneReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, guest_phone, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deluxeSuiteId,
      toSqlDate(addDays(now, 9)),
      toSqlDate(addDays(now, 10)),
      1,
      'PHONE',
      'Karen Mkrtchyan',
      '+374 94 778899',
      'Recorded by front desk — demo baseline for the phone-reservation flow.',
      ownerUserId,
    ],
  );
  // Same accommodation-type nights-only narrowing as the manual block above
  // — date_to (+10) is checkout, only +9 is an occupied night.
  await decrementCalendar(connection, {
    unitId: deluxeSuiteId,
    from: addDays(now, 9),
    to: addDays(now, 9),
    amount: 1,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: phoneReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: PHONE',
  });

  // === 2. Apartment — "Yerevan City Loft" (1 unit + Connections examples) =
  const apartmentListingId = await insertListing(connection, {
    ...commonListingFields,
    listingTypeId: listingTypeIds.get('PROPERTY'),
    categoryId: categoryIdBySlug.get('apartments'),
    citySlug: 'yerevan',
    slug: 'demo-vendor-yerevan-city-loft',
    title: 'Yerevan City Loft',
    summary:
      'A self-contained loft apartment, synced with two external calendars.',
    description:
      'A single, self-check-in loft apartment near the Cascade — this listing is deliberately kept to one bookable unit so its Connections/Sync Center history (a healthy Booking.com iCal import and a failing Airbnb iCal import) is easy to follow end to end.',
    pricingModelId: pricingModelIds.get('PER_NIGHT'),
    amount: 14000,
    imagePaths: ['/assets/images/demo/apartments/apartments-1.svg'],
  });
  const loftUnitId = await insertBookableUnit(connection, {
    listingId: apartmentListingId,
    bookableUnitTypeId: unitTypeIds.get('PROPERTY_UNIT'),
    capacity: 1,
    unitLabel: 'Entire loft',
    ownerUserId,
  });
  await seedCalendarWindow(connection, {
    unitId: loftUnitId,
    capacity: 1,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });

  // Healthy connection: Booking.com iCal import. `IcalConnector` never
  // makes a real network call in tests/demo data — `config.fixtureIcs` (a
  // literal .ics string) is what it reads instead of `config.feedUrl`, so
  // the real, live reconciliation sweep job (already running on this dev
  // server) exercises the exact same import path a production `feedUrl`
  // would, and genuinely stays ACTIVE rather than erroring against a
  // config shape the connector doesn't recognize. The single VEVENT's UID
  // matches the `external_reservations` row inserted below, so the sweep
  // recognizes it as already-imported (idempotent) instead of double
  // counting it.
  const connectorEventUid = 'EVT-1001';
  const fixtureIcs = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `UID:${connectorEventUid}`,
    `DTSTART;VALUE=DATE:${toSqlDate(addDays(now, 14)).replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${toSqlDate(addDays(now, 16)).replace(/-/g, '')}`,
    'SUMMARY:Booking.com reservation #OTA-88213',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const [healthyConnectionResult] = await connection.query(
    `INSERT INTO inventory_connections
      (partner_id, listing_id, connector_type, direction, name, status, config,
       last_attempted_sync_at, last_successful_sync_at, created_by)
     VALUES (?, ?, 'ICAL', 'IMPORT', ?, 'ACTIVE', ?, ?, ?, ?)`,
    [
      partnerId,
      apartmentListingId,
      'Booking.com iCal Sync',
      JSON.stringify({ fixtureIcs }),
      toSqlDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
      toSqlDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
      ownerUserId,
    ],
  );
  const healthyConnectionId = healthyConnectionResult.insertId;
  // `IcalConnector` resolves exactly one mapped unit per connection via
  // the fixed key `'default'` (`DEFAULT_MAPPING_KEY` in icalConnector.js)
  // — any other `external_resource_id` here would make every real sync
  // fail to resolve a unit (AMBIGUOUS_MAPPING), even with a valid feed.
  await connection.query(
    `INSERT INTO inventory_connection_mappings
      (connection_id, external_resource_id, external_resource_name, bookable_unit_id)
     VALUES (?, 'default', 'Yerevan City Loft', ?)`,
    [healthyConnectionId, loftUnitId],
  );
  await connection.query(
    `INSERT INTO inventory_sync_runs
      (connection_id, direction, trigger_code, status, started_at, finished_at,
       records_received, records_created, records_updated, records_skipped, conflicts_count)
     VALUES (?, 'IMPORT', 'SCHEDULED', 'SUCCESS', ?, ?, 1, 1, 0, 0, 0)`,
    [
      healthyConnectionId,
      toSqlDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000)),
      toSqlDateTime(new Date(now.getTime() - 2 * 60 * 60 * 1000 + 4000)),
    ],
  );
  const [connectorReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, external_reference,
       connection_id, external_event_uid, created_by)
     VALUES (?, ?, ?, 1, 'CONNECTOR', 'Booking.com reservation #OTA-88213', ?, ?, ?)`,
    [
      loftUnitId,
      toSqlDate(addDays(now, 14)),
      toSqlDate(addDays(now, 16)),
      healthyConnectionId,
      connectorEventUid,
      ownerUserId,
    ],
  );
  // PROPERTY_UNIT is also an accommodation type — date_to (+16) is
  // checkout, only +14/+15 are occupied nights.
  await decrementCalendar(connection, {
    unitId: loftUnitId,
    from: addDays(now, 14),
    to: addDays(now, 15),
    amount: 1,
    sourceType: LEDGER_SOURCE_TYPES.CONNECTOR_SYNC,
    sourceId: connectorReservationResult.insertId,
    actorUserId: null,
    reason: 'Synced from Booking.com iCal Sync',
  });

  // Degraded connection: Airbnb iCal import currently failing. Genuinely
  // unconfigured (`config: {}` — no `feedUrl`/`fixtureIcs`), matching a
  // real partner who created the connection but never pasted their
  // export URL — the live reconciliation sweep job on this dev server
  // will keep hitting this exact real error on every run, not a faked one.
  const REAL_UNCONFIGURED_ICAL_ERROR =
    'This iCal connection has no feedUrl configured.';
  const [failingConnectionResult] = await connection.query(
    `INSERT INTO inventory_connections
      (partner_id, listing_id, connector_type, direction, name, status, config,
       last_attempted_sync_at, last_successful_sync_at, last_error, created_by)
     VALUES (?, ?, 'ICAL', 'IMPORT', ?, 'ERROR', ?, ?, ?, ?, ?)`,
    [
      partnerId,
      apartmentListingId,
      'Airbnb iCal Sync',
      JSON.stringify({}),
      toSqlDateTime(new Date(now.getTime() - 30 * 60 * 1000)),
      toSqlDateTime(addDays(now, -3)),
      REAL_UNCONFIGURED_ICAL_ERROR,
      ownerUserId,
    ],
  );
  const failingConnectionId = failingConnectionResult.insertId;
  await connection.query(
    `INSERT INTO inventory_connection_mappings
      (connection_id, external_resource_id, external_resource_name, bookable_unit_id)
     VALUES (?, 'default', 'Yerevan City Loft', ?)`,
    [failingConnectionId, loftUnitId],
  );
  await connection.query(
    `INSERT INTO inventory_sync_runs
      (connection_id, direction, trigger_code, status, started_at, finished_at, error_message)
     VALUES (?, 'IMPORT', 'SCHEDULED', 'FAILED', ?, ?, ?)`,
    [
      failingConnectionId,
      toSqlDateTime(new Date(now.getTime() - 30 * 60 * 1000)),
      toSqlDateTime(new Date(now.getTime() - 30 * 60 * 1000 + 2000)),
      REAL_UNCONFIGURED_ICAL_ERROR,
    ],
  );
  const [partialRunResult] = await connection.query(
    `INSERT INTO inventory_sync_runs
      (connection_id, direction, trigger_code, status, started_at, finished_at,
       records_received, records_created, records_updated, records_skipped, conflicts_count)
     VALUES (?, 'IMPORT', 'SCHEDULED', 'PARTIAL', ?, ?, 2, 0, 1, 0, 1)`,
    [
      failingConnectionId,
      toSqlDateTime(addDays(now, -3)),
      toSqlDateTime(new Date(addDays(now, -3).getTime() + 3000)),
    ],
  );
  await connection.query(
    `INSERT INTO inventory_sync_conflicts
      (sync_run_id, connection_id, external_event_uid, conflict_type, details)
     VALUES (?, ?, 'unmapped-room-22', 'AMBIGUOUS_MAPPING', ?)`,
    [
      partialRunResult.insertId,
      failingConnectionId,
      JSON.stringify({
        externalResourceId: 'unmapped-room-22',
        reason: 'No bookable unit mapped to this external resource id.',
      }),
    ],
  );

  // === 3. Tour — "Dilijan Trail Tour" (2 departures, seat capacity states) =
  const tourListingId = await insertListing(connection, {
    ...commonListingFields,
    listingTypeId: listingTypeIds.get('TOUR'),
    categoryId: categoryIdBySlug.get('tours'),
    citySlug: 'dilijan',
    slug: 'demo-vendor-dilijan-trail-tour',
    title: 'Dilijan Trail Tour',
    summary:
      'A guided day hike through the Dilijan forest trails, two daily departures.',
    description:
      "A guided day hike through Dilijan's forest trails with two fixed daily departures — a morning group and an afternoon group, each with its own seat capacity, so the tour manager can adjust either independently.",
    pricingModelId: pricingModelIds.get('PER_PERSON'),
    amount: 9500,
    imagePaths: ['/assets/images/demo/tours/tours-1.svg'],
  });
  const morningDepartureId = await insertBookableUnit(connection, {
    listingId: tourListingId,
    bookableUnitTypeId: unitTypeIds.get('TOUR_DEPARTURE'),
    capacity: 12,
    unitLabel: '09:00 Departure',
    timeSlotStart: '09:00',
    timeSlotEnd: '13:00',
    ownerUserId,
  });
  const afternoonDepartureId = await insertBookableUnit(connection, {
    listingId: tourListingId,
    bookableUnitTypeId: unitTypeIds.get('TOUR_DEPARTURE'),
    capacity: 12,
    unitLabel: '14:00 Departure',
    timeSlotStart: '14:00',
    timeSlotEnd: '18:00',
    ownerUserId,
  });
  await seedCalendarWindow(connection, {
    unitId: morningDepartureId,
    capacity: 12,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });
  await seedCalendarWindow(connection, {
    unitId: afternoonDepartureId,
    capacity: 12,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });
  const [groupReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, notes, created_by)
     VALUES (?, ?, ?, 8, 'TRAVEL_AGENCY', 'Caucasus Tours Group', ?, ?)`,
    [
      morningDepartureId,
      toSqlDate(addDays(now, 7)),
      toSqlDate(addDays(now, 7)),
      'Group booking via a partner travel agency — leaves 4 seats for the morning departure.',
      ownerUserId,
    ],
  );
  await decrementCalendar(connection, {
    unitId: morningDepartureId,
    from: addDays(now, 7),
    to: addDays(now, 7),
    amount: 8,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: groupReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: TRAVEL_AGENCY',
  });
  const [smallGroupReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, notes, created_by)
     VALUES (?, ?, ?, 2, 'PHONE', 'Local family booking', ?, ?)`,
    [
      afternoonDepartureId,
      toSqlDate(addDays(now, 7)),
      toSqlDate(addDays(now, 7)),
      'Small phone booking — leaves 10 seats for the afternoon departure (flow E baseline).',
      ownerUserId,
    ],
  );
  await decrementCalendar(connection, {
    unitId: afternoonDepartureId,
    from: addDays(now, 7),
    to: addDays(now, 7),
    amount: 2,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: smallGroupReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: PHONE',
  });

  // === 4. Activity — "Yerevan Cooking Workshop" (multiple time slots) =====
  const activityListingId = await insertListing(connection, {
    ...commonListingFields,
    listingTypeId: listingTypeIds.get('ATTRACTION'),
    categoryId: categoryIdBySlug.get('attractions'),
    citySlug: 'yerevan',
    slug: 'demo-vendor-yerevan-cooking-workshop',
    title: 'Yerevan Cooking Workshop',
    summary:
      'A hands-on Armenian cooking class, offered in a morning and an evening slot.',
    description:
      "Learn to make traditional Armenian dishes in a small-group, hands-on workshop — offered twice daily so travelers can pick whichever time slot fits their itinerary. Demonstrates the Inventory Engine's multi-time-slot support: two bookable units on one listing, each carrying its own label and time window.",
    pricingModelId: pricingModelIds.get('PER_PERSON'),
    amount: 12000,
    imagePaths: ['/assets/images/demo/attractions/attractions-1.svg'],
  });
  const morningWorkshopId = await insertBookableUnit(connection, {
    listingId: activityListingId,
    bookableUnitTypeId: unitTypeIds.get('TOUR_DEPARTURE'),
    capacity: 8,
    unitLabel: 'Morning Workshop',
    timeSlotStart: '10:00',
    timeSlotEnd: '12:00',
    ownerUserId,
  });
  const eveningWorkshopId = await insertBookableUnit(connection, {
    listingId: activityListingId,
    bookableUnitTypeId: unitTypeIds.get('TOUR_DEPARTURE'),
    capacity: 8,
    unitLabel: 'Evening Workshop',
    timeSlotStart: '18:00',
    timeSlotEnd: '20:00',
    ownerUserId,
  });
  await seedCalendarWindow(connection, {
    unitId: morningWorkshopId,
    capacity: 8,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });
  await seedCalendarWindow(connection, {
    unitId: eveningWorkshopId,
    capacity: 8,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });
  const [workshopReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, notes, created_by)
     VALUES (?, ?, ?, 6, 'PARTNER_WEBSITE', 'Direct booking via partner site', ?, ?)`,
    [
      morningWorkshopId,
      toSqlDate(addDays(now, 5)),
      toSqlDate(addDays(now, 5)),
      'Leaves 2 spots for the morning workshop on this date.',
      ownerUserId,
    ],
  );
  await decrementCalendar(connection, {
    unitId: morningWorkshopId,
    from: addDays(now, 5),
    to: addDays(now, 5),
    amount: 6,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: workshopReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: PARTNER_WEBSITE',
  });

  // === 5. Guide — "Certified Yerevan City Guide" (time-based schedule) ====
  const guideListingId = await insertListing(connection, {
    ...commonListingFields,
    listingTypeId: listingTypeIds.get('ATTRACTION'),
    categoryId: categoryIdBySlug.get('attractions'),
    citySlug: 'yerevan',
    slug: 'demo-vendor-certified-yerevan-city-guide',
    title: 'Certified Yerevan City Guide',
    summary: 'A licensed full-day guide for Yerevan and its surroundings.',
    description:
      'A licensed, English/Russian/Armenian-speaking city guide offering full-day tours of Yerevan and nearby sites. Availability is time-based rather than seat-based — the guide is either free for the day or not — demonstrated here with a real day-by-day available/unavailable schedule.',
    pricingModelId: pricingModelIds.get('PER_PERSON'),
    amount: 25000,
    imagePaths: ['/assets/images/demo/attractions/attractions-2.svg'],
  });
  const guideUnitId = await insertBookableUnit(connection, {
    listingId: guideListingId,
    bookableUnitTypeId: unitTypeIds.get('TOUR_DEPARTURE'),
    capacity: 1,
    unitLabel: 'Full-Day Guide Service',
    ownerUserId,
  });
  await seedCalendarWindow(connection, {
    unitId: guideUnitId,
    capacity: 1,
    from: addDays(now, -2),
    days: 40,
    availableStatusId,
  });
  // Two separate unavailable stretches — a 2-day block and a single day —
  // each gets its own `inventory_blocks` row, a proper ledger entry (via
  // `decrementCalendar`, capacity 1 -> 0), and then the day-level BLOCKED
  // status on top (a guide's personal schedule, not a quantity concept).
  const guideBlockRanges = [
    [addDays(now, 3), addDays(now, 4)],
    [addDays(now, 10), addDays(now, 10)],
  ];
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const [rangeFrom, rangeTo] of guideBlockRanges) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    const [guideBlockResult] = await connection.query(
      `INSERT INTO inventory_blocks
        (bookable_unit_id, date_from, date_to, quantity, reason_code, notes, created_by)
       VALUES (?, ?, ?, 1, 'STAFF_UNAVAILABLE', ?, ?)`,
      [
        guideUnitId,
        toSqlDate(rangeFrom),
        toSqlDate(rangeTo),
        'Guide unavailable — personal time off.',
        ownerUserId,
      ],
    );
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await decrementCalendar(connection, {
      unitId: guideUnitId,
      from: rangeFrom,
      to: rangeTo,
      amount: 1,
      sourceType: LEDGER_SOURCE_TYPES.MANUAL_BLOCK,
      sourceId: guideBlockResult.insertId,
      actorUserId: ownerUserId,
      reason: 'Manual block: STAFF_UNAVAILABLE',
    });
    const blockDates = [];
    let cursor = new Date(rangeFrom);
    while (cursor <= rangeTo) {
      blockDates.push(cursor);
      cursor = addDays(cursor, 1);
    }
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await markCalendarBlocked(connection, {
      unitId: guideUnitId,
      dates: blockDates,
      blockedStatusId,
    });
  }

  // === 6. Car Rental — "Ararat Valley Fleet" (3 vehicles) =================
  const carRentalListingId = await insertListing(connection, {
    ...commonListingFields,
    listingTypeId: listingTypeIds.get('CAR_RENTAL'),
    categoryId: categoryIdBySlug.get('car-rentals'),
    citySlug: 'yerevan',
    slug: 'demo-vendor-ararat-valley-fleet',
    title: 'Ararat Valley Fleet',
    summary:
      'A small rental fleet of three SUVs, each tracked as its own bookable unit.',
    description:
      "Three well-maintained SUVs available for self-drive rental across Armenia's highways and mountain roads. Each vehicle is its own bookable unit with its own plate/date-range availability, so a manager can block or release one vehicle without affecting the others.",
    pricingModelId: pricingModelIds.get('PER_DAY'),
    amount: 13500,
    imagePaths: ['/assets/images/demo/car-rentals/car-rentals-1.svg'],
  });
  const vehicleAId = await insertBookableUnit(connection, {
    listingId: carRentalListingId,
    bookableUnitTypeId: unitTypeIds.get('VEHICLE'),
    capacity: 1,
    unitLabel: 'Toyota RAV4 (01 AA 123)',
    ownerUserId,
  });
  const vehicleBId = await insertBookableUnit(connection, {
    listingId: carRentalListingId,
    bookableUnitTypeId: unitTypeIds.get('VEHICLE'),
    capacity: 1,
    unitLabel: 'Hyundai Tucson (02 BB 456)',
    ownerUserId,
  });
  const vehicleCId = await insertBookableUnit(connection, {
    listingId: carRentalListingId,
    bookableUnitTypeId: unitTypeIds.get('VEHICLE'),
    capacity: 1,
    unitLabel: 'Nissan X-Trail (03 CC 789)',
    ownerUserId,
  });
  // eslint-disable-next-line no-restricted-syntax -- seeding must run in a stable, readable order
  for (const unitId of [vehicleAId, vehicleBId, vehicleCId]) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design
    await seedCalendarWindow(connection, {
      unitId,
      capacity: 1,
      from: addDays(now, -2),
      days: 40,
      availableStatusId,
    });
  }
  const [vehicleReservationResult] = await connection.query(
    `INSERT INTO external_reservations
      (bookable_unit_id, date_from, date_to, quantity, source_code, guest_name, notes, created_by)
     VALUES (?, ?, ?, 1, 'BOOKING_COM', 'OTA reservation', ?, ?)`,
    [
      vehicleBId,
      toSqlDate(addDays(now, 3)),
      toSqlDate(addDays(now, 8)),
      'Externally booked via Booking.com — flow F baseline (this vehicle is unavailable for these dates; try blocking Nissan X-Trail live to prove the same conflict-prevention path).',
      ownerUserId,
    ],
  );
  await decrementCalendar(connection, {
    unitId: vehicleBId,
    from: addDays(now, 3),
    to: addDays(now, 8),
    amount: 1,
    sourceType: LEDGER_SOURCE_TYPES.EXTERNAL_RESERVATION,
    sourceId: vehicleReservationResult.insertId,
    actorUserId: ownerUserId,
    reason: 'External reservation: BOOKING_COM',
  });

  return {
    partnerId,
    listings: {
      hotelListingId,
      apartmentListingId,
      tourListingId,
      activityListingId,
      guideListingId,
      carRentalListingId,
    },
    units: {
      standardRoomId,
      deluxeSuiteId,
      loftUnitId,
      morningDepartureId,
      afternoonDepartureId,
      morningWorkshopId,
      eveningWorkshopId,
      guideUnitId,
      vehicleAId,
      vehicleBId,
      vehicleCId,
    },
    connections: {
      healthyConnectionId,
      failingConnectionId,
    },
  };
}
