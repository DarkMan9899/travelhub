/**
 * Global error-handling middleware.
 *
 * Implements BACKEND_ARCHITECTURE.md §23: the ONLY place that converts a
 * thrown exception into an HTTP response. No Controller contains its own
 * try/catch-to-response logic — a Controller either succeeds or lets its
 * exception propagate here.
 *
 * Response shape matches API_SPECIFICATION.md §8-9 exactly.
 */

import { AppError } from '../errors/AppError.js';
import config from '../config/index.js';
import { createErrorTracker } from '../infrastructure/observability/createErrorTracker.js';

// P0.8 (Master Roadmap): one shared instance for the process lifetime —
// mirrors this file's own "plain module-level dependency" shape rather
// than threading a new constructor argument through app.js, matching
// how `config`/`logger` are already imported directly here.
const errorTracker = createErrorTracker();

// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  const isAppError = err instanceof AppError;
  const httpStatus = isAppError ? err.httpStatus : 500;
  const code = isAppError ? err.code : 'INTERNAL_ERROR';

  // Full internal detail is always logged server-side, regardless of
  // what is safe to return to the client (BACKEND_ARCHITECTURE.md §23).
  const log = req.log ?? req.app.get('logger');
  const logPayload = { err, code, httpStatus, requestId: req.requestId };
  if (httpStatus >= 500) {
    log?.error(logPayload, 'Unhandled error');
    // P0.8: only genuine server-side failures (5xx) go to the error
    // tracker — a 4xx is an expected, already-handled outcome
    // (validation, auth, not-found), not a signal something is broken.
    errorTracker.captureException(err, {
      code,
      httpStatus,
      requestId: req.requestId,
    });
  } else {
    log?.warn(logPayload, 'Request failed');
  }

  // Never leak internal detail (stack traces, driver-specific messages)
  // to the client in production — only the safe, documented message.
  const message =
    isAppError || !config.isProduction
      ? err.message
      : 'An unexpected error occurred.';

  res.status(httpStatus).json({
    success: false,
    data: null,
    meta: null,
    error: {
      code,
      message,
      details: isAppError ? err.details : undefined,
      request_id: req.requestId,
    },
  });
}
