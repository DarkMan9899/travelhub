/**
 * Admin module DTOs — response shaping only (BACKEND_ARCHITECTURE.md Ch.9).
 *
 * `bookingValueByCurrency` is deliberately never collapsed into a single
 * "revenue" number: the real `payments` module exists (Stripe-capable,
 * with refunds/ledger) but is paused platform-wide via `PAYMENTS_ENABLED`
 * (a boot-time env constant, no admin-editable path — see
 * `paymentService.js#assertPaymentsEnabled`) — this is the listed value
 * of Confirmed/Completed bookings, not money that has actually changed
 * hands, and the frontend labels it "Booking Value" accordingly.
 */

export function toDashboardResponse(stats) {
  return {
    counts: {
      users: stats.counts.users,
      partners: stats.counts.partners,
      listings: stats.counts.listings,
      published_listings: stats.counts.publishedListings,
      bookings: stats.counts.bookings,
      completed_bookings: stats.counts.completedBookings,
    },
    pending_actions: {
      pending_partners: stats.pendingActions.pendingPartners,
      pending_listings: stats.pendingActions.pendingListings,
      pending_bookings: stats.pendingActions.pendingBookings,
    },
    booking_value_by_currency: stats.bookingValueByCurrency.map((entry) => ({
      currency_code: entry.currencyCode,
      total: entry.total,
    })),
    bookings_by_day: stats.bookingsByDay,
    recent_activity: stats.recentActivity.map((entry) => ({
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      created_at: entry.createdAt,
      actor_name: entry.actorName,
    })),
  };
}

export default toDashboardResponse;
