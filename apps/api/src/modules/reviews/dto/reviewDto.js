/**
 * Reviews module response DTOs (BACKEND_ARCHITECTURE.md Ch.9).
 */

export function toReviewResponse(review) {
  return {
    id: review.id,
    customer_user_id: review.customerUserId,
    booking_id: review.bookingId,
    listing_id: review.listingId,
    rating: review.rating,
    title: review.title,
    content: review.content,
    status: review.statusCode,
    vendor_response: review.vendorResponse,
    vendor_responded_at: review.vendorRespondedAt,
    created_at: review.createdAt,
    updated_at: review.updatedAt,
    // Additive, only present when the repository joined it (listing review
    // lists, not the single-review create response) — the reviewer's
    // display name, never the full user record.
    customer_display_name: review.customerDisplayName ?? undefined,
  };
}

export function toReviewSummaryResponse(summary) {
  return {
    listing_id: summary.listingId,
    rating_average: summary.ratingAverage,
    review_count: summary.reviewCount,
  };
}
