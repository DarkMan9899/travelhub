/**
 * `profile` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point other modules/pages may import from
 * (§6.3).
 */

export { default as ProfilePageContent } from './components/ProfilePageContent/ProfilePageContent.jsx';
export { default as SettingsPageContent } from './components/SettingsPageContent/SettingsPageContent.jsx';
export { default as DashboardOverviewContent } from './components/DashboardOverviewContent/DashboardOverviewContent.jsx';
