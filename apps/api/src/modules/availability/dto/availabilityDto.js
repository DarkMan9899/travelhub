/**
 * Availability module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 *
 * `toBookableUnitResponse` is `bookable_units` (owner/admin management —
 * `source_table`/`source_id` are internal bookkeeping for the polymorphic
 * inventory pointer and are deliberately not exposed here). `
 * toCalendarEntryResponse` is `availability_calendar` (the primary engine,
 * owner/admin management view). `toBlackoutManagementResponse` (owner/
 * admin, includes `id`/`reason`) and `toPublicRangeResponse` (public, no
 * `reason`/`id`) are both `blackout_dates` — the complementary veto layer.
 * `toCalendarDayResponse` is the public, merged day-by-day view.
 */

export function toBookableUnitResponse(unit) {
  return {
    id: unit.id,
    listing_id: unit.listingId,
    bookable_unit_type: unit.bookableUnitTypeCode,
    capacity: unit.capacity,
    created_at: unit.createdAt,
    updated_at: unit.updatedAt,
  };
}

export function toCalendarEntryResponse(entry) {
  return {
    id: entry.id,
    bookable_unit_id: entry.bookableUnitId,
    date: entry.date,
    status: entry.statusCode,
    quantity_available: entry.quantityAvailable,
    price_override_amount: entry.priceOverrideAmount,
    price_override_currency: entry.priceOverrideCurrencyCode,
    created_at: entry.createdAt,
    updated_at: entry.updatedAt,
  };
}

export function toBlackoutManagementResponse(block) {
  return {
    id: block.id,
    listing_id: block.listingId,
    date_from: block.dateFrom,
    date_to: block.dateTo,
    reason: block.reason,
    created_at: block.createdAt,
    updated_at: block.updatedAt,
  };
}

export function toPublicRangeResponse(block) {
  return {
    date_from: block.dateFrom,
    date_to: block.dateTo,
  };
}

export function toCalendarDayResponse(day) {
  return {
    date: day.date,
    status: day.status,
  };
}
