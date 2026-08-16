/**
 * Normalized API error shape (FRONTEND_ARCHITECTURE.md §10.8) — every
 * `api/*.js` call rejects with this, never a raw Axios error. A
 * component's catch block / React Query `error` always has one
 * predictable shape (`code`, `message`, `details`, `requestId`,
 * `status`) matching one of API_SPECIFICATION.md Appendix A's codes,
 * regardless of whether the failure was a structured API error response,
 * a network failure, or a request that never reached the server.
 */
export default class ApiError extends Error {
  constructor({ code, message, details, requestId, status }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.status = status;
  }
}

/** Builds an ApiError from an Axios error, handling every failure shape. */
export function normalizeError(error) {
  const { response } = error;
  const envelope = response?.data?.error;

  if (envelope) {
    return new ApiError({
      code: envelope.code,
      message: envelope.message,
      details: envelope.details,
      requestId: envelope.request_id,
      status: response.status,
    });
  }

  if (error.code === 'ERR_NETWORK' || !response) {
    return new ApiError({
      code: 'NETWORK_ERROR',
      message:
        'Unable to reach the server. Check your connection and try again.',
      status: undefined,
    });
  }

  return new ApiError({
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Something went wrong.',
    status: response.status,
  });
}
