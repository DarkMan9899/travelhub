/**
 * Email copy templates (Phase 13) — English-only, plain text.
 *
 * Every other user-facing string in this codebase is rendered
 * client-side via i18n (Phase 4.2's "i18n owns all labels" rule), but
 * email has to be rendered server-side (there is no client involved).
 * This app has no server-side i18n renderer and building one is out of
 * scope for this phase — documented limitation, not faked with a
 * half-working translation shim.
 */

const TEMPLATES = {
  'booking.created': ({ bookingReference }) => ({
    subject: 'Booking received',
    body: `Your booking ${bookingReference ?? ''} has been received and is awaiting vendor confirmation.`,
  }),
  'booking.confirmed': ({ bookingReference }) => ({
    subject: 'Booking confirmed',
    body: `Your booking ${bookingReference ?? ''} has been confirmed.`,
  }),
  'booking.rejected': ({ bookingReference }) => ({
    subject: 'Booking rejected',
    body: `Your booking ${bookingReference ?? ''} was rejected by the vendor.`,
  }),
  'booking.cancelled': ({ bookingReference }) => ({
    subject: 'Booking cancelled',
    body: `Your booking ${bookingReference ?? ''} has been cancelled.`,
  }),
  'booking.completed': ({ bookingReference }) => ({
    subject: 'Trip completed',
    body: `Your booking ${bookingReference ?? ''} is complete. We'd love to hear about your stay.`,
  }),
  'review.submitted': ({ listingTitle, rating }) => ({
    subject: 'New review received',
    body: `Your listing "${listingTitle ?? ''}" received a new ${rating ?? '?'}-star review.`,
  }),
  'favorite.added': ({ listingTitle }) => ({
    subject: 'Someone favorited your listing',
    body: `A traveler favorited your listing "${listingTitle ?? ''}".`,
  }),
  'partner.approved': ({ partnerName }) => ({
    subject: 'Partner application approved',
    body: `Congratulations — "${partnerName ?? 'Your partner account'}" has been approved.`,
  }),
  'listing.approved': ({ listingTitle }) => ({
    subject: 'Listing approved',
    body: `Your listing "${listingTitle ?? ''}" has been approved and is now live.`,
  }),
  'listing.rejected': ({ listingTitle, notes }) => ({
    subject: 'Listing rejected',
    body: `Your listing "${listingTitle ?? ''}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
  }),
  'admin.announcement': ({ title, body }) => ({
    subject: title ?? 'Announcement',
    body: body ?? '',
  }),
};

/** Falls back to a generic rendering for any event type without a specific template above. */
export function renderEmail(eventType, payload = {}) {
  const template = TEMPLATES[eventType];
  if (template) return template(payload);
  return {
    subject: 'Notification',
    body: `Event: ${eventType}\n${JSON.stringify(payload)}`,
  };
}

export default renderEmail;
