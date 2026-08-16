# Module: notifications

**Domain group:** Engagement
**Specification:** see `BACKEND_ARCHITECTURE.md` Part XI (Module Catalog) for
this module's Purpose, Responsibilities, Public/Internal Services,
Dependencies, Database Tables, Events, Queue Jobs, Transactions, Caching
Rules, Error Strategy, and Validation Strategy.
**Endpoint contract:** see `API_SPECIFICATION.md` for this module's exact
request/response shapes.

**Phase 13 status:** implemented — the Notifications Center. This module
is a **subscriber**, not a callee: business modules never call it
directly, they publish domain events (`src/core/events/`) that this
module's `events/notificationListener.js` reacts to. Delivery channels
(In-App, Email now; Push/SMS/Webhook reserved for later) are adapters
behind a channel interface (`channels/`) — the rest of this module never
knows which channel(s) fired.

No rendered title/body text is ever stored — `event_type` + a structured
`payload` JSON only, per this codebase's established rule that i18n owns
every user-facing label (Phase 4.2).

## Folder contents (per BACKEND_ARCHITECTURE.md §2)

- `controllers/` — HTTP-to-Service translation only (Ch. 5)
- `services/` — Application-layer use cases (Ch. 6): `NotificationService`,
  `NotificationPreferenceService`, `NotificationDeliveryService`
- `repositories/` — database access (Ch. 7): `notifications`/
  `notification_preferences` (migration 0021)
- `dto/` — request/response shapes (Ch. 9)
- `validators/` — Layer 2 structural validation (Ch. 10)
- `events/` — `notificationListener.js`, this module's `DomainEventBus`
  subscriber registration — the only place this module reacts to events
  published elsewhere
- `channels/` — delivery-channel adapters (`emailChannelAdapter.js` port +
  `consoleEmailProvider.js` default implementation, swappable for a real
  provider later with zero business-logic change)
- `jobs/` — `notificationDeliveryQueue.js`, the BullMQ queue that carries
  async channel dispatch (e.g. email) off the request's critical path
