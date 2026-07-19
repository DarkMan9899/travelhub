/**
 * Users module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> build DTO ->
 * call Service -> shape response. No business logic, no direct database
 * access, no try/catch-to-response — a thrown `AppError` always
 * propagates to `next()` and is shaped exactly once, by the global error
 * handler (`src/middleware/errorHandler.js`), never inline here.
 */

import { ValidationError } from '../../../errors/AppError.js';

function toUserResponse(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.firstName,
    last_name: user.lastName,
    phone: user.phone,
    avatar_media_id: user.avatarMediaId,
    preferred_language_id: user.preferredLanguageId,
    preferred_currency_id: user.preferredCurrencyId,
    is_email_verified: user.isEmailVerified,
    is_phone_verified: user.isPhoneVerified,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

export function createUserController(userService) {
  return {
    async updateProfile(req, res, next) {
      try {
        const { id } = req.validated.params;
        const user = await userService.updateProfile(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toUserResponse(user),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async changePassword(req, res, next) {
      try {
        const { id } = req.validated.params;
        const { currentPassword, newPassword } = req.validated.body;
        await userService.changePassword(
          req.principal,
          id,
          currentPassword,
          newPassword,
        );
        res.status(200).json({
          success: true,
          data: { changed: true },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async uploadAvatar(req, res, next) {
      try {
        const { id } = req.validated.params;
        const buffer = req.body;
        const mimeType = req.headers['content-type'];

        // Gross size/DoS protection lives in module.routes.js's
        // express.raw({ limit }) — Express itself rejects an
        // over-limit body with 413 before this handler ever runs. This
        // check only guards against an empty/missing body reaching the
        // Service; the per-MIME-type size *policy* check
        // (mediaConstraints.js) belongs in UserService.setAvatar, not
        // duplicated here.
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
          throw new ValidationError('Request body must be a non-empty image.');
        }

        const user = await userService.setAvatar(
          req.principal,
          id,
          buffer,
          mimeType,
        );
        res.status(200).json({
          success: true,
          data: toUserResponse(user),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createUserController;
