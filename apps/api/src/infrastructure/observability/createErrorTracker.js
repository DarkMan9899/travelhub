/**
 * ErrorTracker factory — P0.8 (Master Roadmap). Mirrors
 * `createStorageProvider()`'s exact shape: one composition point,
 * selected by `config.errorTracking.provider`.
 */

import config from '../../config/index.js';
import { NoOpErrorTracker } from './noOpErrorTracker.js';
import { SentryErrorTracker } from './sentryErrorTracker.js';

export function createErrorTracker() {
  if (config.errorTracking.provider === 'sentry') {
    return new SentryErrorTracker({
      dsn: config.errorTracking.sentry.dsn,
      environment: config.env,
    });
  }
  return new NoOpErrorTracker();
}

export default createErrorTracker;
