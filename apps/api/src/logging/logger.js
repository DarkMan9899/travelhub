/**
 * Structured (JSON) logging.
 *
 * Implements BACKEND_ARCHITECTURE.md §20: structured logging exclusively
 * (never a bare console.log), with automatic, centralized redaction of
 * known-sensitive fields — no call site has to remember to redact
 * anything itself.
 *
 * Every log line carries a `module` field (set via `logger.child(...)`)
 * so log lines are filterable by owning module in the monitoring
 * pipeline, per BACKEND_ARCHITECTURE.md §51.
 */

import pino from 'pino';
import config from '../config/index.js';

const REDACT_PATHS = [
  'password',
  '*.password',
  'token',
  '*.token',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'authorization',
  'req.headers.authorization',
  'cardNumber',
  '*.cardNumber',
  'cvv',
  '*.cvv',
  'secret',
  '*.secret',
];

const logger = pino({
  level: config.logging.level,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  base: {
    env: config.env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

/**
 * Returns a child logger scoped to one module, e.g.:
 *   const log = getModuleLogger('booking-holds');
 *   log.info({ holdId }, 'hold created');
 */
export function getModuleLogger(moduleName) {
  return logger.child({ module: moduleName });
}

export default logger;
