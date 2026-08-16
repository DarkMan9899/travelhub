/** Admin AI moderation controller (Stage 15.6) — parse input -> call Service -> shape response. */

import {
  toModerationQueueResponse,
  toModerationScoreResponse,
} from '../dto/moderationDto.js';

export function createModerationController(moderationHeuristicsService) {
  return {
    async queue(req, res, next) {
      try {
        const entries = await moderationHeuristicsService.getModerationQueue(
          req.principal,
          { limit: req.validated.query.limit },
        );
        res.status(200).json({
          success: true,
          data: toModerationQueueResponse(entries),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async score(req, res, next) {
      try {
        const result = await moderationHeuristicsService.scoreListing(
          req.principal,
          req.validated.params.listingId,
        );
        res.status(200).json({
          success: true,
          data: toModerationScoreResponse(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createModerationController;
