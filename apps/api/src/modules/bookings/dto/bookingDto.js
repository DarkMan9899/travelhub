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
    listing_id: booking.listingId,
    booking_type: booking.bookingTypeCode,
    status: booking.statusCode,
    currency: booking.currencyCode,
    total_amount: booking.totalAmount,
    requested_at: booking.requestedAt,
  };
}
