/**
 * Admin module Controller (BACKEND_ARCHITECTURE.md Ch.5: parse input ->
 * call Service -> shape response).
 */

import { toDashboardResponse } from '../dto/adminDto.js';

export function createAdminController(adminService) {
  return {
    async getDashboard(req, res, next) {
      try {
        const stats = await adminService.getDashboardStats();
        res.status(200).json({
          success: true,
          data: toDashboardResponse(stats),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAdminController;
