/** AI memory Controller (Phase 15) — parse input -> call Service -> shape response. */

import { toMemoryListResponse } from '../dto/aiMemoryDto.js';

export function createAiMemoryController(aiMemoryService) {
  return {
    async list(req, res, next) {
      try {
        const entries = await aiMemoryService.getMemoryForUser(req.principal);
        res.status(200).json({
          success: true,
          data: toMemoryListResponse(entries),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async remove(req, res, next) {
      try {
        await aiMemoryService.deleteMemoryKey(
          req.principal,
          req.validated.params.key,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAiMemoryController;
