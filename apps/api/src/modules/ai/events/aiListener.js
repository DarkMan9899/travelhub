/**
 * AI event listener (Phase 15) — mirrors
 * `notifications/events/notificationListener.js`'s exact shape: AI is a
 * subscriber, never a publisher, of the shared `DomainEventBus`.
 * Registered once from the composition root (`routes/v1.js`) after every
 * container exists, alongside `registerNotificationListeners`.
 *
 * Subscribes to exactly three event types — all three already publish
 * today (`BOOKING_COMPLETED`, `REVIEW_SUBMITTED`, `FAVORITE_ADDED`) — and
 * passively updates `ai_user_memory`'s destination/category affinity
 * counters. `CONVERSATION_CREATED`/`NOTIFICATION_READ` are deliberately
 * NOT subscribed to: there is no real behavior to trigger from them yet,
 * and a listener with nothing to do would repeat the exact "fake
 * listener" anti-pattern Phase 13's own plan rejected.
 *
 * Phase 15 "AI Polish" sprint: `REVIEW_SUBMITTED` only records affinity
 * when `payload.rating >= POSITIVE_REVIEW_RATING_THRESHOLD` — a 1-2 star
 * review is real signal that this user did NOT enjoy the listing, so
 * recording it as an affinity (as the code did before this change) was
 * actively pushing Recommendations toward listings similar to ones the
 * user disliked. A review with no numeric `rating` in its payload is
 * treated as unscored and skipped, never treated as positive by default.
 *
 * Every handler resolves the affected listing via the already-injected
 * `bookingService`/`listingService` — a cross-module Service call, never
 * a second Repository over `bookings`/`listings` (the same rule
 * `notificationListener.js` follows for `partnerService`/
 * `conversationService`). A resolution failure (e.g. a since-deleted
 * listing) is caught and logged, never rethrown — the event bus already
 * isolates listener failures via `Promise.allSettled`, but this listener
 * additionally guards its own multi-step lookups so one bad event never
 * skips the rest of this handler's siblings.
 */

import { EVENT_TYPES } from '../../../core/events/eventTypes.js';
import { getModuleLogger } from '../../../logging/logger.js';

const log = getModuleLogger('ai:listener');

const POSITIVE_REVIEW_RATING_THRESHOLD = 4;

async function resolveListingAffinity(listingService, listingId) {
  const listing = await listingService.getListing(null, listingId);
  return {
    categoryCode: listing.categoryIds?.[0]
      ? String(listing.categoryIds[0])
      : null,
    categoryLabel: listing.categoryIds?.[0]
      ? String(listing.categoryIds[0])
      : null,
    cityCode: listing.location?.cityId ? String(listing.location.cityId) : null,
    cityLabel: listing.location?.cityName ?? null,
  };
}

export function registerAiListeners({
  eventBus,
  aiMemoryService,
  bookingService,
  listingService,
}) {
  eventBus.subscribe(EVENT_TYPES.FAVORITE_ADDED, async (event) => {
    try {
      const userId = event.actorId;
      const { categoryCode, categoryLabel, cityCode, cityLabel } =
        await resolveListingAffinity(listingService, event.payload.listingId);
      await Promise.all([
        aiMemoryService.recordCategoryAffinity(
          userId,
          categoryCode,
          categoryLabel,
        ),
        aiMemoryService.recordDestinationAffinity(userId, cityCode, cityLabel),
      ]);
    } catch (err) {
      log.warn(
        { err, eventId: event.eventId },
        'Failed to update AI memory for favorite.added',
      );
    }
  });

  eventBus.subscribe(EVENT_TYPES.REVIEW_SUBMITTED, async (event) => {
    if ((event.payload.rating ?? 0) < POSITIVE_REVIEW_RATING_THRESHOLD) {
      return;
    }
    try {
      const userId = event.actorId;
      const { categoryCode, categoryLabel, cityCode, cityLabel } =
        await resolveListingAffinity(listingService, event.payload.listingId);
      await Promise.all([
        aiMemoryService.recordCategoryAffinity(
          userId,
          categoryCode,
          categoryLabel,
        ),
        aiMemoryService.recordDestinationAffinity(userId, cityCode, cityLabel),
      ]);
    } catch (err) {
      log.warn(
        { err, eventId: event.eventId },
        'Failed to update AI memory for review.submitted',
      );
    }
  });

  eventBus.subscribe(EVENT_TYPES.BOOKING_COMPLETED, async (event) => {
    try {
      const { customerUserId } = event.payload;
      const booking = await bookingService.getBooking(
        { userId: customerUserId, roles: [] },
        event.resourceId,
      );
      const { categoryCode, categoryLabel, cityCode, cityLabel } =
        await resolveListingAffinity(listingService, booking.listingId);
      await Promise.all([
        aiMemoryService.recordCategoryAffinity(
          customerUserId,
          categoryCode,
          categoryLabel,
        ),
        aiMemoryService.recordDestinationAffinity(
          customerUserId,
          cityCode,
          cityLabel,
        ),
      ]);
    } catch (err) {
      log.warn(
        { err, eventId: event.eventId },
        'Failed to update AI memory for booking.completed',
      );
    }
  });
}

export default registerAiListeners;
