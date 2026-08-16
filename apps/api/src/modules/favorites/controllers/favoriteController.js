/**
 * Favorites module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response. No business logic, no direct database access.
 */

import { toFavoritedListingResponse } from '../dto/favoriteDto.js';

export function createFavoriteController(favoriteService) {
  return {
    async add(req, res, next) {
      try {
        await favoriteService.addFavorite(
          req.principal,
          req.validated.body.listingId,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        const { listingId } = req.validated.params;
        await favoriteService.removeFavorite(req.principal, listingId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async listIds(req, res, next) {
      try {
        const ids = await favoriteService.listFavoritedListingIds(
          req.principal,
        );
        res.status(200).json({
          success: true,
          data: ids,
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async list(req, res, next) {
      try {
        const { cursor, limit } = req.validated.query;
        const { rows, meta } = await favoriteService.listFavorites(
          req.principal,
          { cursor, limit: limit ?? 20 },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toFavoritedListingResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createFavoriteController;
