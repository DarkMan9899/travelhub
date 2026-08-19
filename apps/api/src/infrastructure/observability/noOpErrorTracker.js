/**
 * NoOpErrorTracker — the default `ErrorTracker` implementation (P0.8,
 * Master Roadmap). Mirrors `ConsoleEmailProvider`/`LocalPaymentProvider`'s
 * exact precedent: a real, observable path (this app's own structured,
 * already-redacted pino logger), never a silent no-op — a real failure
 * is never lost, it just isn't forwarded to an external service until a
 * real provider is configured.
 */

import { getModuleLogger } from '../../logging/logger.js';
import { ErrorTracker } from '../../core/interfaces/ErrorTracker.js';

const log = getModuleLogger('observability:noop');

export class NoOpErrorTracker extends ErrorTracker {
  captureException(err, context) {
    log.error(
      { err, ...context },
      'Error captured (NoOpErrorTracker — no error-tracking provider configured)',
    );
  }

  captureMessage(message, context) {
    log.warn(
      { ...context },
      `Message captured (NoOpErrorTracker — no error-tracking provider configured): ${message}`,
    );
  }

  // eslint-disable-next-line class-methods-use-this
  async flush() {
    return true;
  }
}

export default NoOpErrorTracker;
