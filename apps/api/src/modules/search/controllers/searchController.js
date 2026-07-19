/**
 * Search module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response. `GET /search` and `GET /search/listings` both route to
 * `searchListings` (see `module.routes.js`) — listings are the only
 * searchable entity that exists yet, so there is exactly one handler, not
 * two near-duplicates.
 */

import {
  toSearchResultResponse,
  toCategoryResultResponse,
  toSuggestionResponse,
} from '../dto/searchDto.js';

export function createSearchController(searchService) {
  return {
    async searchListings(req, res, next) {
      try {
        const { rows, meta } = await searchService.searchListings(
          req.principal,
          req.validated.query,
        );
        res.status(200).json({
          success: true,
          data: rows.map(toSearchResultResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async searchCategories(req, res, next) {
      try {
        const categories = await searchService.searchCategories(
          req.validated.query.locale,
        );
        res.status(200).json({
          success: true,
          data: categories.map(toCategoryResultResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async suggest(req, res, next) {
      try {
        const suggestions = await searchService.suggest(
          req.validated.query.q,
          req.validated.query.locale,
        );
        res.status(200).json({
          success: true,
          data: suggestions.map(toSuggestionResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createSearchController;
