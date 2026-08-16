/** AI Recommendations Controller (Stage 15.4) — parse input -> call Service -> shape response. */

import { toRecommendationsResponse } from '../dto/recommendationDto.js';

export function createRecommendationController(recommendationService) {
  return {
    async list(req, res, next) {
      try {
        const result = await recommendationService.getRecommendations(
          req.principal,
          {},
        );
        res.status(200).json({
          success: true,
          data: toRecommendationsResponse(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createRecommendationController;
