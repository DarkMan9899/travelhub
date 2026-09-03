/**
 * Auth module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). `register`/`login`/`refresh`/`password-reset/request`/
 * `password-reset/confirm` are public and rate-limited under
 * `sensitiveRateLimiter` (Sprint 5's tier reserved for exactly this:
 * "Login, password reset, coupon-redemption-class sensitive endpoints").
 * `logout`/`logout-all`/`me` require authentication.
 */

import { Router } from 'express';
import { sensitiveRateLimiter } from '../../middleware/rateLimiter.js';
import { validate } from '../../validation/validate.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
} from './validators/authValidators.js';

export default function createAuthRoutes({ authController, guards }) {
  const router = Router();
  const { requireAuth } = guards;

  router.post(
    '/register',
    sensitiveRateLimiter,
    validate(registerSchema),
    authController.register,
  );
  router.post(
    '/login',
    sensitiveRateLimiter,
    validate(loginSchema),
    authController.login,
  );
  router.post(
    '/refresh',
    sensitiveRateLimiter,
    validate(refreshSchema),
    authController.refresh,
  );
  // Public, unauthenticated — same `sensitiveRateLimiter` tier this
  // file's own header comment already names "password reset" under.
  router.post(
    '/password-reset/request',
    sensitiveRateLimiter,
    validate(requestPasswordResetSchema),
    authController.requestPasswordReset,
  );
  router.post(
    '/password-reset/confirm',
    sensitiveRateLimiter,
    validate(resetPasswordSchema),
    authController.resetPassword,
  );
  router.post('/logout', requireAuth, authController.logout);
  router.post('/logout-all', requireAuth, authController.logoutAll);
  router.get('/me', requireAuth, authController.me);

  return router;
}
