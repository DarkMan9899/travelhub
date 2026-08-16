/**
 * FavoriteService — public Service for the Favorites module (Phase 12,
 * Product Polish: minimal Favorites module — see the plan's Scope
 * decision #2). Depends on `ListingService`'s public interface only to
 * verify a listing is visible before it can be favorited, never a
 * second Repository over `listings` (BACKEND_ARCHITECTURE.md §4).
 */

import { AuthenticationError } from '../../../errors/AppError.js';
import { createNoOpEventBus } from '../../../core/events/domainEventBus.js';
import { createDomainEvent } from '../../../core/events/createDomainEvent.js';
import { EVENT_TYPES } from '../../../core/events/eventTypes.js';

export class FavoriteService {
  #favoriteRepository;

  #listingService;

  #eventBus;

  constructor({
    favoriteRepository,
    listingService,
    eventBus = createNoOpEventBus(),
  }) {
    this.#favoriteRepository = favoriteRepository;
    this.#listingService = listingService;
    this.#eventBus = eventBus;
  }

  async addFavorite(principal, listingId) {
    if (!principal) throw new AuthenticationError();
    // Throws NotFoundError for an unpublished/nonexistent listing —
    // the same visibility rule the public listing detail page uses.
    const listing = await this.#listingService.getListing(principal, listingId);
    await this.#favoriteRepository.add(principal.userId, listingId);

    await this.#eventBus.publish(
      createDomainEvent({
        eventType: EVENT_TYPES.FAVORITE_ADDED,
        actorId: principal.userId,
        resourceType: 'listing',
        resourceId: listingId,
        payload: { listingId, partnerId: listing.partnerId },
      }),
    );
  }

  async removeFavorite(principal, listingId) {
    if (!principal) throw new AuthenticationError();
    await this.#favoriteRepository.remove(principal.userId, listingId);
  }

  /** Lightweight — every favorited listing id, for hydrating heart-toggle state on card grids. */
  async listFavoritedListingIds(principal) {
    if (!principal) throw new AuthenticationError();
    return this.#favoriteRepository.listListingIdsForCustomer(principal.userId);
  }

  async listFavorites(principal, paginationOpts = {}) {
    if (!principal) throw new AuthenticationError();
    return this.#favoriteRepository.listForCustomer(
      principal.userId,
      paginationOpts,
    );
  }
}

export default FavoriteService;
