/**
 * Users module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). Every route requires authentication
 * (`API_SPECIFICATION.md` §28); ownership vs. `user.update`-class
 * permission fallbacks are enforced inside `UserService`, not here.
 */

import express, { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  updateProfileSchema,
  changePasswordSchema,
  avatarParamsSchema,
} from './validators/userValidators.js';
import { ALLOWED_IMAGE_MIME_TYPES } from '../media/validators/mediaConstraints.js';

export default function createUserRoutes({ userController, guards }) {
  const router = Router();
  const { requireAuth } = guards;

  router.patch(
    '/:id',
    requireAuth,
    validate(updateProfileSchema),
    userController.updateProfile,
  );

  router.post(
    '/:id/change-password',
    requireAuth,
    validate(changePasswordSchema),
    userController.changePassword,
  );

  router.post(
    '/:id/avatar',
    requireAuth,
    // Scoped to this one route only — the global body parser
    // (express.json in src/app.js) skips non-JSON content-types, so this
    // doesn't affect any other route. Express itself rejects a body over
    // `limit` with 413 before uploadAvatar ever runs.
    express.raw({ type: ALLOWED_IMAGE_MIME_TYPES, limit: '10mb' }),
    validate(avatarParamsSchema),
    userController.uploadAvatar,
  );

  return router;
}
