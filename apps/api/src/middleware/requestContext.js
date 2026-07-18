/**
 * Request context middleware.
 *
 * Implements BACKEND_ARCHITECTURE.md §11: assigns a request_id to every
 * incoming request (API_SPECIFICATION.md §9), attached to all downstream
 * logging and to the error envelope, so a displayed error and a backend
 * log line can always be correlated.
 *
 * This is the FIRST middleware in the chain (after security headers/CORS)
 * — see src/app.js for the fixed, documented middleware order.
 */

import { randomUUID } from 'node:crypto';
import { getModuleLogger } from '../logging/logger.js';

const baseLogger = getModuleLogger('http');

export default function requestContext(req, res, next) {
  const requestId = `req_${randomUUID()}`;
  req.requestId = requestId;
  req.log = baseLogger.child({ requestId });
  res.setHeader('X-Request-Id', requestId);
  next();
}
