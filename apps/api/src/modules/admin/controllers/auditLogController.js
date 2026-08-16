/**
 * Audit Log module Controller — Stage 11.7 Admin Platform. Parse input ->
 * call Service -> shape response, no logic.
 */

import { toAuditLogResponse } from '../dto/auditLogDto.js';

export function createAuditLogController(auditLogService) {
  return {
    async list(req, res, next) {
      try {
        const {
          actorId,
          targetType,
          targetId,
          action,
          dateFrom,
          dateTo,
          cursor,
          limit,
        } = req.validated.query;
        const { rows, meta } = await auditLogService.list(req.principal, {
          actorId,
          targetType,
          targetId,
          action,
          dateFrom,
          dateTo,
          cursor,
          limit,
        });
        res.status(200).json({
          success: true,
          data: rows.map(toAuditLogResponse),
          meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAuditLogController;
