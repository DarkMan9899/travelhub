/**
 * System Health module Controller — Stage 11.8 Admin Platform. Parse
 * input -> call Service -> shape response, no logic.
 */

import { toSystemHealthResponse } from '../dto/systemHealthDto.js';

export function createSystemHealthController(systemHealthService) {
  return {
    async getSystemHealth(req, res, next) {
      try {
        const health = await systemHealthService.getSystemHealth();
        res.status(200).json({
          success: true,
          data: toSystemHealthResponse(health),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createSystemHealthController;
