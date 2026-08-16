/**
 * Bookings module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 */

function toBookingItemResponse(item) {
  return {
    id: item.id,
    bookable_unit_id: item.bookableUnitId,
    date_from: item.dateFrom,
    date_to: item.dateTo,
    quantity: item.quantity,
    unit_price_amount: item.unitPriceAmount,
    guests: (item.guests ?? []).map((guest) => ({
      id: guest.id,
      full_name: guest.fullName,
      document_number: guest.documentNumber,
    })),
  };
}

export function toBookingResponse(booking) {
  return {
    id: booking.id,
    booking_reference: booking.bookingReference,
    customer_user_id: booking.customerUserId,
    partner_id: booking.partnerId,
    // Resolved via `partnerService.getOwnerUserId` (see
    // `bookingService.js`'s `#hydrate`) — the user id a customer's
    // "Message partner" entry point sends as `participantUserIds` to
    // `POST /messaging/conversations`. `null` for a partner with no
    // owner_user_id set (a real, if rare, data gap) rather than a
    // fabricated id. Additive to the single-booking shape only, never
    // the list summary (`toBookingSummaryResponse`) — no per-row N+1.
    partner_owner_user_id: booking.partnerOwnerUserId ?? null,
    listing_id: booking.listingId,
    booking_type: booking.bookingTypeCode,
    status: booking.statusCode,
    customer_notes: booking.customerNotes,
    guest_contact_snapshot: booking.guestContactSnapshot,
    currency: booking.currencyCode,
    subtotal_amount: booking.subtotalAmount,
    fees_amount: booking.feesAmount,
    discount_amount: booking.discountAmount,
    total_amount: booking.totalAmount,
    payment_method: booking.paymentMethod,
    payment_status: booking.paymentStatusCode,
    requested_at: booking.requestedAt,
    confirmed_at: booking.confirmedAt,
    rejected_at: booking.rejectedAt,
    cancelled_at: booking.cancelledAt,
    completed_at: booking.completedAt,
    cancellation_reason: booking.cancellationReason,
    created_at: booking.createdAt,
    updated_at: booking.updatedAt,
    items: (booking.items ?? []).map(toBookingItemResponse),
  };
}

export function toBookingSummaryResponse(booking) {
  return {
    id: booking.id,
    booking_reference: booking.bookingReference,
    // Stage 11.4 (Admin Platform — Booking Operations): additive —
    // `toBookingResponse` (the single-booking shape) always had these;
    // the admin bookings list needs them too, to link each row to the
    // customer/partner's own admin detail page (Stages 11.1/11.2).
    customer_user_id: booking.customerUserId,
    partner_id: booking.partnerId,
    listing_id: booking.listingId,
    booking_type: booking.bookingTypeCode,
    status: booking.statusCode,
    currency: booking.currencyCode,
    total_amount: booking.totalAmount,
    requested_at: booking.requestedAt,
    // Phase 8 (Auth / User Dashboard): earliest date_from / latest date_to
    // across the booking's items — added additively so the dashboard can
    // tell an upcoming trip apart from history without fetching each
    // booking's full item detail. Null for a booking with no items yet
    // (shouldn't happen post-creation, but the LEFT JOIN makes it possible
    // in principle).
    date_from: booking.tripDateFrom ?? null,
    date_to: booking.tripDateTo ?? null,
  };
}

/** Stage 11.4: one `booking_status_history` row. */
export function toBookingStatusHistoryResponse(entry) {
  return {
    id: entry.id,
    from_status: entry.from_status_code,
    to_status: entry.to_status_code,
    changed_by: entry.changed_by,
    changed_at: entry.created_at,
  };
}
