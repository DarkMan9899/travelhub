/**
 * Booking-Holds module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 */

export function toHoldBatchResponse({ items, expiresAt }) {
  return {
    items: items.map((item) => ({
      bookable_unit_id: item.unitId,
      date_from: item.dateFrom,
      date_to: item.dateTo,
      // Sprint B (Car Rental Pickup/Return Interval) — the server-
      // validated, granted value, echoed back the same way `date_from`/
      // `date_to` already are; `null` for every non-VEHICLE hold.
      start_time: item.startTime ?? null,
      end_time: item.endTime ?? null,
      quantity: item.quantity,
      hold_ids: item.holdIds,
    })),
    expires_at: expiresAt,
  };
}

export function toHoldResponse(hold) {
  return {
    id: hold.id,
    bookable_unit_id: hold.bookableUnitId,
    date_from: hold.dateFrom,
    date_to: hold.dateTo,
    expires_at: hold.expiresAt,
    created_at: hold.createdAt,
  };
}
