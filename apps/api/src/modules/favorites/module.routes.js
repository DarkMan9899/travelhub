/**
 * Favorites module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). Every route requires authentication — favorites are
 * always the requester's own.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  addFavoriteSchema,
  listingIdParamsSchema,
  listFavoritesQuerySchema,
} from './validators/favoriteValidators.js';

export default function createFavoriteRoutes({ favoriteController, guards }) {
  const router = Router();
  const { requireAuth } = guards;

  router.post(
    '/',
    requireAuth,
    validate(addFavoriteSchema),
    favoriteController.add,
  );

  router.get(
    '/',
    requireAuth,
    validate(listFavoritesQuerySchema),
    favoriteController.list,
  );

  router.get('/ids', requireAuth, favoriteController.listIds);

  router.delete(
    '/:listingId',
    requireAuth,
    validate(listingIdParamsSchema),
    favoriteController.remove,
  );

  return router;
}
