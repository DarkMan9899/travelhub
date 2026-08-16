/**
 * AI Assistant Controller (Stage 15.3). `stream` is this codebase's first
 * Server-Sent-Events route — plain `res.write` chunks over the existing
 * HTTP stack (no new dependency), the same "simplest correct mechanism"
 * call Messaging's own transport made for polling. A failure before the
 * first chunk still goes through the normal `next(err)`/error-middleware
 * path; a failure mid-stream is written as one final `event: error` frame
 * since headers are already committed by then.
 */

import {
  toAskResponse,
  toAssistantConversationListResponse,
  toAssistantConversationResponse,
} from '../dto/assistantDto.js';

function writeSseEvent(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function createAssistantController(assistantService) {
  return {
    async ask(req, res, next) {
      try {
        const result = await assistantService.ask(
          req.principal,
          req.validated.body,
        );
        res.status(200).json({
          success: true,
          data: toAskResponse(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async stream(req, res, next) {
      let streamStarted = false;
      try {
        const chunks = assistantService.streamAsk(
          req.principal,
          req.validated.body,
        );
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        streamStarted = true;
        // eslint-disable-next-line no-restricted-syntax -- sequential SSE frames by design
        for await (const chunk of chunks) {
          writeSseEvent(res, 'message', chunk);
        }
        res.end();
      } catch (err) {
        if (streamStarted) {
          writeSseEvent(res, 'error', { message: err.message });
          res.end();
        } else {
          next(err);
        }
      }
    },

    async listConversations(req, res, next) {
      try {
        const page = await assistantService.listConversations(
          req.principal,
          req.validated.query,
        );
        res.status(200).json({
          success: true,
          data: toAssistantConversationListResponse(page),
          meta: page.meta,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async getConversation(req, res, next) {
      try {
        const conversation = await assistantService.getConversation(
          req.principal,
          req.validated.params.id,
        );
        res.status(200).json({
          success: true,
          data: toAssistantConversationResponse(conversation),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async deleteConversation(req, res, next) {
      try {
        await assistantService.deleteConversation(
          req.principal,
          req.validated.params.id,
        );
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAssistantController;
