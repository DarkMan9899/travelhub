/**
 * AI usage-dashboard controller — parse input -> call Service -> shape
 * response. `dashboard` backs the Admin AI usage dashboard (Stage 15.6);
 * `partnerDashboard` (Phase 15 "AI Polish" sprint) backs the partner-scoped
 * counterpart, reusing the identical response DTO.
 */

import { toUsageDashboardResponse } from '../dto/aiUsageDto.js';

export function createAiUsageController(aiUsageService) {
  return {
    async dashboard(req, res, next) {
      try {
        const { since } = req.validated.query;
        const [stats, recent] = await Promise.all([
          aiUsageService.getAggregateStats({ since }),
          aiUsageService.listRecent({ limit: 50 }),
        ]);
        res.status(200).json({
          success: true,
          data: toUsageDashboardResponse({ stats, recent }),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async partnerDashboard(req, res, next) {
      try {
        const { partnerId, since } = req.validated.query;
        const { stats, recent } = await aiUsageService.getPartnerUsage(
          req.principal,
          partnerId,
          { since },
        );
        res.status(200).json({
          success: true,
          data: toUsageDashboardResponse({ stats, recent }),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAiUsageController;
