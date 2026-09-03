/**
 * `notifications` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point another module/page may import from
 * (§6.3). Consumed by every layout (`NotificationBell`, added to the
 * shared `actions` fragment) and by the three role-scoped page wrappers
 * (`NotificationsPageContent`, role-agnostic — the backend already
 * scopes by the requester's own id).
 */

export { default as NotificationBell } from './components/NotificationBell/NotificationBell.jsx';
export { default as NotificationsPageContent } from './components/NotificationsPageContent/NotificationsPageContent.jsx';
export { default as NotificationPreferencesSection } from './components/NotificationPreferences/NotificationPreferencesSection.jsx';
export { useUnreadCountQuery } from './queries/useUnreadCountQuery.js';
