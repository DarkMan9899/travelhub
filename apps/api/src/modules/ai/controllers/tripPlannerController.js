/** Trip Planner Controller (Stage 15.1) — parse input -> call Service -> shape response. */

import {
  toTripPlanResponse,
  toAiConversationResponse,
} from '../dto/tripPlannerDto.js';

export function createTripPlannerController(tripPlannerService) {
  return {
    async plan(req, res, next) {
      try {
        const plan = await tripPlannerService.planTrip(
          req.principal,
          req.validated.body,
        );
        res.status(201).json({
          success: true,
          data: toTripPlanResponse(plan),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getById(req, res, next) {
      try {
        const conversation = await tripPlannerService.getTrip(
          req.principal,
          req.validated.params.id,
        );
        res.status(200).json({
          success: true,
          data: toAiConversationResponse(conversation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createTripPlannerController;
