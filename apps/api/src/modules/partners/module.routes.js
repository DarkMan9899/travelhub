/**
 * Partners module route wiring (BACKEND_ARCHITECTURE.md §2: route wiring
 * only, no logic). `GET /mine` requires authentication — there is no
 * meaningful anonymous answer to "which partner orgs do I belong to."
 *
 * Phase 10: `GET /` and `GET /:slug` are the module's first public
 * routes (Companies directory + profile) — no auth required, same
 * unauthenticated-read pattern as `GET /listings`. `/mine` is registered
 * before `/:slug` so Express doesn't match the literal path `/mine` as
 * `:slug = "mine"`.
 */

import { Router } from 'express';
import { validate } from '../../validation/validate.js';
import {
  listPublicPartnersQuerySchema,
  partnerSlugParamsSchema,
  userIdParamsSchema,
  listPartnersAdminQuerySchema,
  partnerIdParamsSchema,
  updateVerificationStatusSchema,
  updateModerationStatusSchema,
  createApplicationSchema,
  updateApplicationSchema,
} from './validators/partnerValidators.js';

export default function createPartnerRoutes({ partnerController, guards }) {
  const router = Router();
  const { requireAuth, requirePermission } = guards;

  router.get('/mine', requireAuth, partnerController.getMine);

  // P1.2 (Master Roadmap) — self-service application. Registered before
  // `/:slug` for the same collision-avoidance reason as `/mine`/`/admin`
  // below (`/applications` is more than one path segment, but kept
  // alongside them for readability). No special permission required —
  // any authenticated user may start an application; only the ADMIN
  // review side (`/admin/*`) is permission-gated.
  // Registered before `/applications/:id` — a collection route ("list
  // everything") and an item route on the same base path, same ordering
  // rule as everywhere else in this file.
  router.get(
    '/applications',
    requireAuth,
    partnerController.listMyApplications,
  );
  router.post(
    '/applications',
    requireAuth,
    validate(createApplicationSchema),
    partnerController.apply,
  );
  router.get(
    '/applications/:id',
    requireAuth,
    validate(partnerIdParamsSchema),
    partnerController.getMyApplication,
  );
  router.patch(
    '/applications/:id',
    requireAuth,
    validate(updateApplicationSchema),
    partnerController.updateMyApplication,
  );
  router.post(
    '/applications/:id/submit',
    requireAuth,
    validate(partnerIdParamsSchema),
    partnerController.submitMyApplication,
  );

  // Phase 11 Admin Platform — registered before `/:slug` (same reason
  // `/mine` is): `/by-user/:userId` is two path segments so it never
  // actually collides with `/:slug`'s one-segment match, but kept
  // alongside `/mine` for readability.
  router.get(
    '/by-user/:userId',
    requireAuth,
    requirePermission('user.view'),
    validate(userIdParamsSchema),
    partnerController.getMembershipsForUser,
  );

  // Stage 11.2 (Partner Management) — `/admin*`, registered before
  // `/:slug` for the same collision-avoidance reason as `/mine` and
  // `/by-user/:userId`. Each route's own permission requirement is
  // enforced again inside `PartnerService` (defense in depth, matching
  // every other admin route in this codebase) — the guard here is the
  // fast-fail layer.
  router.get(
    '/admin',
    requireAuth,
    requirePermission('partner.verify', 'partner.moderate'),
    validate(listPartnersAdminQuerySchema),
    partnerController.listAdmin,
  );
  router.get(
    '/admin/:id',
    requireAuth,
    requirePermission('partner.verify', 'partner.moderate'),
    validate(partnerIdParamsSchema),
    partnerController.getAdminDetail,
  );
  router.patch(
    '/admin/:id/verification-status',
    requireAuth,
    requirePermission('partner.verify'),
    validate(updateVerificationStatusSchema),
    partnerController.updateVerificationStatus,
  );
  router.patch(
    '/admin/:id/moderation-status',
    requireAuth,
    requirePermission('partner.moderate'),
    validate(updateModerationStatusSchema),
    partnerController.updateModerationStatus,
  );

  router.get(
    '/',
    validate(listPublicPartnersQuerySchema),
    partnerController.list,
  );

  router.get(
    '/:slug',
    validate(partnerSlugParamsSchema),
    partnerController.getBySlug,
  );

  return router;
}
