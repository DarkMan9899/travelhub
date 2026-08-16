/**
 * `favorites` module public export surface (FRONTEND_ARCHITECTURE.md
 * §6.2) — the ONLY entry point another module/page may import from
 * (§6.3). Consumed by `listings`/`search` (`FavoriteButton` on cards)
 * and `routes` (`FavoritesPageContent`).
 */

export { default as FavoriteButton } from './components/FavoriteButton/FavoriteButton.jsx';
export { default as FavoritesPageContent } from './components/FavoritesPageContent/FavoritesPageContent.jsx';
