/**
 * Listings module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic), mirroring `modules/users/module.routes.js`.
 *
 * `GET /`, `GET /:id`, and `GET /:id/media` do not require authentication
 * — `authenticate.js` (mounted globally in `app.js`) still populates
 * `req.principal` when a valid token is present, which `ListingService`
 * uses for the owner-vs-public visibility rule. Every mutating route
 * requires authentication; ownership vs. `listing.*`-permission fallbacks
 * are enforced inside `ListingService`, not here.
 */

import express, { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  createListingSchema,
  updateListingSchema,
  listingIdParamsSchema,
  listingMediaIdParamsSchema,
  updateListingMediaSchema,
  listListingsQuerySchema,
} from './validators/listingValidators.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ALLOWED_VIDEO_MIME_TYPES,
} from '../media/validators/mediaConstraints.js';

const ALLOWED_LISTING_MEDIA_MIME_TYPES = [
  ...ALLOWED_IMAGE_MIME_TYPES,
  ...ALLOWED_VIDEO_MIME_TYPES,
];

export default function createListingRoutes({ listingController, guards }) {
  const router = Router();
  const { requireAuth } = guards;

  router.post(
    '/',
    requireAuth,
    validate(createListingSchema),
    listingController.create,
  );

  router.get('/', validate(listListingsQuerySchema), listingController.list);

  router.get('/:id', validate(listingIdParamsSchema), listingController.get);

  router.patch(
    '/:id',
    requireAuth,
    validate(updateListingSchema),
    listingController.update,
  );

  router.delete(
    '/:id',
    requireAuth,
    validate(listingIdParamsSchema),
    listingController.remove,
  );

  router.post(
    '/:id/publish',
    requireAuth,
    validate(listingIdParamsSchema),
    listingController.publish,
  );

  router.post(
    '/:id/unpublish',
    requireAuth,
    validate(listingIdParamsSchema),
    listingController.unpublish,
  );

  router.get(
    '/:id/media',
    validate(listingIdParamsSchema),
    listingController.listMedia,
  );

  router.post(
    '/:id/media',
    requireAuth,
    // Scoped to this one route only, same pattern as the users module's
    // avatar upload — the global body parser skips non-JSON content-types.
    express.raw({ type: ALLOWED_LISTING_MEDIA_MIME_TYPES, limit: '200mb' }),
    validate(listingIdParamsSchema),
    listingController.attachMedia,
  );

  router.patch(
    '/:id/media/:mediaId',
    requireAuth,
    validate(updateListingMediaSchema),
    listingController.updateMedia,
  );

  router.delete(
    '/:id/media/:mediaId',
    requireAuth,
    validate(listingMediaIdParamsSchema),
    listingController.removeMedia,
  );

  return router;
}
