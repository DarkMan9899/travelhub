/**
 * Partner staff/invitations module Controller (P1.4, Master Roadmap).
 * Same request -> Service -> response shape as `partnerController.js`.
 */

import {
  toStaffMemberResponse,
  toInvitationResponse,
  toInvitationPreviewResponse,
} from '../dto/partnerStaffDto.js';

export function createPartnerStaffController(partnerStaffService) {
  return {
    async listStaff(req, res, next) {
      try {
        const { id } = req.validated.params;
        const staff = await partnerStaffService.listStaff(req.principal, id);
        res.status(200).json({
          success: true,
          data: staff.map(toStaffMemberResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async updateStaffRole(req, res, next) {
      try {
        const { id, employeeId } = req.validated.params;
        const { roleCode } = req.validated.body;
        const staff = await partnerStaffService.updateStaffRole(
          req.principal,
          id,
          employeeId,
          roleCode,
        );
        res.status(200).json({
          success: true,
          data: toStaffMemberResponse(staff),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async removeStaff(req, res, next) {
      try {
        const { id, employeeId } = req.validated.params;
        await partnerStaffService.removeStaff(req.principal, id, employeeId);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async listInvitations(req, res, next) {
      try {
        const { id } = req.validated.params;
        const invitations = await partnerStaffService.listInvitations(
          req.principal,
          id,
        );
        res.status(200).json({
          success: true,
          data: invitations.map(toInvitationResponse),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async inviteStaff(req, res, next) {
      try {
        const { id } = req.validated.params;
        const invitation = await partnerStaffService.inviteStaff(
          req.principal,
          id,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toInvitationResponse(invitation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async revokeInvitation(req, res, next) {
      try {
        const { id, invitationId } = req.validated.params;
        await partnerStaffService.revokeInvitation(
          req.principal,
          id,
          invitationId,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async previewInvitation(req, res, next) {
      try {
        const { token } = req.validated.params;
        const preview = await partnerStaffService.previewInvitation(token);
        res.status(200).json({
          success: true,
          data: toInvitationPreviewResponse(preview),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async acceptInvitation(req, res, next) {
      try {
        const { token } = req.validated.params;
        const staff = await partnerStaffService.acceptInvitation(
          req.principal,
          token,
        );
        res.status(200).json({
          success: true,
          data: toStaffMemberResponse(staff),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createPartnerStaffController;
