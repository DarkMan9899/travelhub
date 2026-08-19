/**
 * SentryErrorTracker — real `ErrorTracker` adapter against Sentry
 * (`@sentry/node`) — P0.8, Master Roadmap. Same "real adapter, never
 * live-called without a real key configured" precedent
 * `StripePaymentProvider`/`ResendEmailProvider` already establish:
 * selected via `ERROR_TRACKING_PROVIDER=sentry` + `SENTRY_DSN` (see
 * config/index.js), inert everywhere neither is set.
 *
 * `#redact` reuses this app's own `SENSITIVE_FIELD_NAMES` (the exact
 * field list the structured logger already redacts) so a real Sentry
 * account never receives a password/token/card-number/secret/API-key
 * this app's own logging already treats as sensitive — one source of
 * truth for "what counts as sensitive here," not two lists that could
 * drift apart.
 */

import * as Sentry from '@sentry/node';
import { ErrorTracker } from '../../core/interfaces/ErrorTracker.js';
import { SENSITIVE_FIELD_NAMES } from '../../logging/logger.js';

/** Exported for direct unit testing — the one piece of genuinely novel logic in this file, everything else is thin Sentry SDK wiring. */
export function redact(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));

  const result = {};
  for (const [key, val] of Object.entries(value)) {
    result[key] = SENSITIVE_FIELD_NAMES.includes(key)
      ? '[REDACTED]'
      : redact(val, seen);
  }
  return result;
}

export class SentryErrorTracker extends ErrorTracker {
  constructor({ dsn, environment, tracesSampleRate = 0 } = {}) {
    super();
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate,
      beforeSend(event) {
        return { ...event, extra: redact(event.extra) };
      },
    });
  }

  // eslint-disable-next-line class-methods-use-this
  captureException(err, context) {
    Sentry.captureException(err, { extra: redact(context) });
  }

  // eslint-disable-next-line class-methods-use-this
  captureMessage(message, context) {
    Sentry.captureMessage(message, { extra: redact(context) });
  }

  // eslint-disable-next-line class-methods-use-this
  async flush(timeoutMs = 2000) {
    return Sentry.flush(timeoutMs);
  }
}

export default SentryErrorTracker;
