/**
 * `reviews` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point another module/page may import from
 * (§6.3). Consumed by `listings` (Listing Detail's reviews section),
 * `bookings` (BookingDetailPageContent's "leave a review" gate), and
 * (Admin Sprint 4) `admin`'s review moderation queue/detail pages, the
 * same "shared status badge lives in its owning feature module" pattern
 * `bookings` already established for `BookingStatusBadge`.
 */

export { default as ReviewForm } from './components/ReviewForm/ReviewForm.jsx';
export { default as ReviewsList } from './components/ReviewsList/ReviewsList.jsx';
export { default as ReviewModerationStatusBadge } from './components/ReviewModerationStatusBadge/ReviewModerationStatusBadge.jsx';
export { useReviewForBookingQuery } from './queries/useReviewForBookingQuery.js';
