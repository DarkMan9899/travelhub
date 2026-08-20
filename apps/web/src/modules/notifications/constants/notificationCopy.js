/**
 * Notification copy registry — the single source of truth mapping a
 * notification's `event_type` + `payload` to an i18n key + interpolation
 * params. This is why the backend stores no rendered text at all (Phase
 * 4.2's "i18n owns all labels" rule): the frontend is the only place
 * that decides what a notification says.
 *
 * `admin.announcement` is the one exception — an admin composed that
 * text directly at authoring time (there is no server-side i18n
 * renderer, Phase 13's documented limitation), so it's rendered as-is
 * rather than looked up by key.
 */

const REGISTRY = {
  'booking.created': (payload) => ({
    key: 'notifications.copy.bookingCreated',
    params: { reference: payload.bookingReference },
  }),
  'booking.confirmed': (payload) => ({
    key: 'notifications.copy.bookingConfirmed',
    params: { reference: payload.bookingReference },
  }),
  'booking.rejected': (payload) => ({
    key: 'notifications.copy.bookingRejected',
    params: { reference: payload.bookingReference },
  }),
  'booking.cancelled': (payload) => ({
    key: 'notifications.copy.bookingCancelled',
    params: { reference: payload.bookingReference },
  }),
  'booking.completed': (payload) => ({
    key: 'notifications.copy.bookingCompleted',
    params: { reference: payload.bookingReference },
  }),
  'review.submitted': (payload) => ({
    key: 'notifications.copy.reviewSubmitted',
    params: { rating: payload.rating },
  }),
  'favorite.added': () => ({
    key: 'notifications.copy.favoriteAdded',
    params: {},
  }),
  'partner.approved': (payload) => ({
    key: 'notifications.copy.partnerApproved',
    params: { partnerName: payload.partnerName },
  }),
  // P1.2 (Master Roadmap) — the two other real review outcomes.
  'partner.rejected': (payload) => ({
    key: 'notifications.copy.partnerRejected',
    params: { partnerName: payload.partnerName },
  }),
  'partner.needs_changes': (payload) => ({
    key: 'notifications.copy.partnerNeedsChanges',
    params: { partnerName: payload.partnerName },
  }),
  'listing.approved': () => ({
    key: 'notifications.copy.listingApproved',
    params: {},
  }),
  'listing.rejected': (payload) => ({
    key: 'notifications.copy.listingRejected',
    params: { notes: payload.notes ?? '' },
  }),
};

/** @returns {{ isAnnouncement: true, title: string, body: string } | { isAnnouncement: false, key: string, params: object }} */
export function getNotificationCopy(eventType, payload = {}) {
  if (eventType === 'admin.announcement') {
    return {
      isAnnouncement: true,
      title: payload.title ?? '',
      body: payload.body ?? '',
    };
  }
  const resolve = REGISTRY[eventType];
  if (!resolve) {
    return {
      isAnnouncement: false,
      key: 'notifications.copy.generic',
      params: { eventType },
    };
  }
  return { isAnnouncement: false, ...resolve(payload) };
}

export default getNotificationCopy;
