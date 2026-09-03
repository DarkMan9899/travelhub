/**
 * `messaging` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point another module/page may import from
 * (§6.3). Consumed by every protected layout (`MessagingBell`, added to
 * the shared `actions` fragment), by the three role-scoped page wrappers
 * (`MessagingPageContent`, role-agnostic — the backend already scopes by
 * participation/`messaging.view_all`), and by `useCreateConversationMutation`
 * — the "message the partner/customer about this booking" entry point on
 * the booking detail pages (`bookings`/`partner` modules), a context-scoped
 * `POST /messaging/conversations` call the backend makes idempotent per
 * (contextType, contextId, principal).
 */

export { default as MessagingBell } from './components/MessagingBell/MessagingBell.jsx';
export { default as MessagingPageContent } from './components/MessagingPageContent/MessagingPageContent.jsx';
export { useCreateConversationMutation } from './mutations/useCreateConversationMutation.js';
export { useUnreadConversationCountQuery } from './queries/useUnreadConversationCountQuery.js';
