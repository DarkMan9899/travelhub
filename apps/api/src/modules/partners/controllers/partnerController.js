/**
 * Partners module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> call Service ->
 * shape response.
 */

import {
  toPartnershipResponse,
  toPartnerSummaryResponse,
  toPartnerDetailResponse,
  toAdminPartnerSummaryResponse,
  toAdminPartnerDetailResponse,
} from '../dto/partnerDto.js';

export function createPartnerController(partnerService) {
  return {
    // P1.2 (Master Roadmap) — self-service partner onboarding.
    async listMyApplications(req, res, next) {
      try {
        const applications = await partnerService.getMyApplications(
          req.principal,
        );
        res.status(200).json({
          success: true,
          data: applications.map(toPartnershipResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async apply(req, res, next) {
      try {
        const application = await partnerService.applyToBecomePartner(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toAdminPartnerDetailResponse(application),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getMyApplication(req, res, next) {
      try {
        const { id } = req.validated.params;
        const application = await partnerService.getMyApplication(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: toAdminPartnerDetailResponse(application),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateMyApplication(req, res, next) {
      try {
        const { id } = req.validated.params;
        const application = await partnerService.updateMyApplication(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toAdminPartnerDetailResponse(application),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async submitMyApplication(req, res, next) {
      try {
        const { id } = req.validated.params;
        const application = await partnerService.submitMyApplication(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: toAdminPartnerDetailResponse(application),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getMine(req, res, next) {
      try {
        const memberships = await partnerService.getMyPartnerships(
          req.principal,
        );
        res.status(200).json({
          success: true,
          data: memberships.map(toPartnershipResponse),
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
        const { rows, meta } = await partnerService.listPublicPartners({
          cursor,
          limit,
        });
        res.status(200).json({
          success: true,
          data: rows.map(toPartnerSummaryResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getBySlug(req, res, next) {
      try {
        const { slug } = req.validated.params;
        const partner = await partnerService.getPublicPartnerBySlug(slug);
        res.status(200).json({
          success: true,
          data: toPartnerDetailResponse(partner),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getMembershipsForUser(req, res, next) {
      try {
        const { userId } = req.validated.params;
        const memberships =
          await partnerService.listMembershipsForUserAdmin(userId);
        res.status(200).json({
          success: true,
          data: memberships.map(toPartnershipResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async listAdmin(req, res, next) {
      try {
        const { keyword, verificationStatus, moderationStatus, cursor, limit } =
          req.validated.query;
        const { rows, meta } = await partnerService.listPartnersAdmin(
          req.principal,
          { keyword, verificationStatus, moderationStatus },
          { cursor, limit },
        );
        res.status(200).json({
          success: true,
          data: rows.map(toAdminPartnerSummaryResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getAdminDetail(req, res, next) {
      try {
        const { id } = req.validated.params;
        const partner = await partnerService.getPartnerAdminDetail(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: toAdminPartnerDetailResponse(partner),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateVerificationStatus(req, res, next) {
      try {
        const { id } = req.validated.params;
        const { status, reviewNote } = req.validated.body;
        const partner = await partnerService.updateVerificationStatus(
          req.principal,
          id,
          status,
          { reviewNote },
        );
        res.status(200).json({
          success: true,
          data: toAdminPartnerDetailResponse(partner),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateModerationStatus(req, res, next) {
      try {
        const { id } = req.validated.params;
        const { status } = req.validated.body;
        const partner = await partnerService.updateModerationStatus(
          req.principal,
          id,
          status,
        );
        res.status(200).json({
          success: true,
          data: toAdminPartnerDetailResponse(partner),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createPartnerController;
