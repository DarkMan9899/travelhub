/**
 * Typing Controller (BACKEND_ARCHITECTURE.md Ch.5): parse input -> call
 * Service -> shape response. No business logic.
 */

export function createTypingController(typingIndicatorService) {
  return {
    async setTyping(req, res, next) {
      try {
        await typingIndicatorService.setTyping(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },

    async listTyping(req, res, next) {
      try {
        const userIds = await typingIndicatorService.listTypingUsers(
          req.principal,
          req.validated.params.id,
        );
        res.status(200).json({
          success: true,
          data: { typing_user_ids: userIds },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createTypingController;
