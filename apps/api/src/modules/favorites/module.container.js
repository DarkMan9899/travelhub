/**
 * Favorites module DI container (BACKEND_ARCHITECTURE.md §17).
 *
 * Takes `listingService` as an injected dependency (constructed by
 * `routes/v1.js` after the Listings container) — never a second
 * Repository over `listings`, the same cross-module rule every other
 * module in this codebase already follows.
 */

import { MySqlFavoriteRepository } from './repositories/mysqlFavoriteRepository.js';
import { FavoriteService } from './services/favoriteService.js';
import { createFavoriteController } from './controllers/favoriteController.js';

export default function createFavoritesContainer({ listingService, eventBus }) {
  const favoriteRepository = new MySqlFavoriteRepository();
  const favoriteService = new FavoriteService({
    favoriteRepository,
    listingService,
    eventBus,
  });
  const favoriteController = createFavoriteController(favoriteService);

  return {
    favoriteRepository,
    favoriteService,
    favoriteController,
  };
}
