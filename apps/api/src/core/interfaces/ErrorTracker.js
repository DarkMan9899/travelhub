/**
 * ErrorTracker port — P0.8 (Master Roadmap).
 *
 * Abstraction over "where does a real, actionable signal about a
 * production failure go" — mirrors `StorageProvider`/`PaymentProvider`'s
 * exact shape in this codebase: a concrete implementation lives in
 * `infrastructure/observability/`, selected at the composition root via
 * config, with a real, non-throwing default (`NoOpErrorTracker`) so
 * nothing in this app ever depends on a live account existing.
 */

/* eslint-disable class-methods-use-this, no-unused-vars */
export class ErrorTracker {
  /**
   * @param {Error} err
   * @param {object} [context] - arbitrary extra data (requestId, code, jobName, ...)
   */
  captureException(err, context) {
    throw new Error(
      'ErrorTracker.captureException must be implemented by a concrete adapter.',
    );
  }

  /** @param {string} message @param {object} [context] */
  captureMessage(message, context) {
    throw new Error(
      'ErrorTracker.captureMessage must be implemented by a concrete adapter.',
    );
  }

  /** Flushes any buffered events — call before process exit. @param {number} [timeoutMs] */
  async flush(timeoutMs) {
    throw new Error(
      'ErrorTracker.flush must be implemented by a concrete adapter.',
    );
  }
}
/* eslint-enable class-methods-use-this, no-unused-vars */

export default ErrorTracker;
