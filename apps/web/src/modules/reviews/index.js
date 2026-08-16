/**
 * `reviews` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point another module/page may import from
 * (§6.3). Consumed by `listings` (Listing Detail's reviews section) and
 * `bookings` (BookingDetailPageContent's "leave a review" gate).
 */

export { default as ReviewForm } from './components/ReviewForm/ReviewForm.jsx';
export { default as ReviewsList } from './components/ReviewsList/ReviewsList.jsx';
export { useReviewForBookingQuery } from './queries/useReviewForBookingQuery.js';
