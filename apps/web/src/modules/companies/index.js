/**
 * `companies` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point other modules/pages may import from
 * (§6.3). Phase 10 redesign: the Companies/Partners public directory.
 */

export { default as CompaniesDirectoryPageContent } from './components/CompaniesDirectoryPageContent/CompaniesDirectoryPageContent.jsx';
export { default as CompanyProfilePageContent } from './components/CompanyProfilePageContent/CompanyProfilePageContent.jsx';
