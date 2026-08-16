/**
 * Configuration loader.
 *
 * Implements BACKEND_ARCHITECTURE.md §18 (Configuration Management) and
 * §19 (Environment Variables): every required environment variable is
 * validated for presence and type ONCE, at process start, before the
 * application accepts its first request. A missing or malformed value
 * is a fail-fast startup error — never a runtime surprise discovered on
 * the first request that happens to need it.
 *
 * No secret is ever logged (see src/logging/logger.js's redaction rule).
 */

import 'dotenv/config';
import { cleanEnv, str, num, url } from 'envalid';

const env = cleanEnv(process.env, {
  NODE_ENV: str({
    choices: ['development', 'staging', 'production', 'test'],
    default: 'development',
  }),
  PORT: num({ default: 4000 }),

  // Database (DATABASE_ARCHITECTURE.md — MySQL 8.x)
  DATABASE_HOST: str({ default: 'localhost' }),
  DATABASE_PORT: num({ default: 3306 }),
  DATABASE_NAME: str({ default: 'travelhub' }),
  DATABASE_USER: str({ default: 'travelhub' }),
  DATABASE_PASSWORD: str({ default: '' }),
  // Isolated database for the `integration` Jest project (Sprint 5 §"test
  // database isolation") — never the same database as DATABASE_NAME, so
  // integration tests can freely migrate/seed/truncate without touching
  // development data.
  DATABASE_NAME_TEST: str({ default: 'travelhub_test' }),

  // Redis (BACKEND_ARCHITECTURE.md §38)
  REDIS_URL: url({ default: 'redis://localhost:6379' }),

  // JWT (BACKEND_ARCHITECTURE.md §12)
  JWT_ACCESS_SECRET: str({ default: 'dev-only-access-secret-change-me' }),
  JWT_REFRESH_SECRET: str({ default: 'dev-only-refresh-secret-change-me' }),
  JWT_ACCESS_EXPIRY: str({ default: '15m' }),
  JWT_REFRESH_EXPIRY: str({ default: '30d' }),

  // Booking Engine constants (BOOKING_ENGINE_ARCHITECTURE.md §5.2) — tunable
  // without a deploy, per BACKEND_ARCHITECTURE.md §18's system_settings note.
  RESERVATION_HOLD_DURATION_MINUTES: num({ default: 15 }),
  // Sprint 10: how long a booking may sit in PENDING_VENDOR before the
  // scheduled sweep auto-expires it — a separate, much longer window than
  // the reservation-hold TTL above (that one guards checkout; this one
  // guards a vendor's response time on an already-created booking).
  BOOKING_PENDING_VENDOR_SLA_HOURS: num({ default: 48 }),

  // Rate limiting (BACKEND_ARCHITECTURE.md §48 / API_SPECIFICATION.md §17)
  RATE_LIMIT_AUTHENTICATED_PER_MINUTE: num({ default: 300 }),
  RATE_LIMIT_PUBLIC_PER_MINUTE: num({ default: 20 }),
  RATE_LIMIT_SENSITIVE_PER_MINUTE: num({ default: 10 }),
  // A separate, still-bounded tier for the build-time `prerender.mjs`
  // pipeline (Phase 20 SEO), never the public internet: a full site crawl
  // easily exceeds the public tier's 20/min in real, sequential traffic
  // (228 routes x several data fetches each), and authenticating as a
  // real user to reach the authenticated tier isn't an option — it would
  // bake a specific logged-in header state into HTML a crawler must see
  // as anonymous. Only requests presenting the exact
  // PRERENDER_INTERNAL_TOKEN secret AND originating from the loopback
  // interface (rateLimiter.js's isLoopbackRequest — req.ip is never
  // derived from a spoofable header here, this app never sets `trust
  // proxy`) use this tier; every other request, including one that only
  // guesses the token from off-host, still hits the normal public tier.
  // Empty by default: the tier is unreachable until an operator opts in.
  RATE_LIMIT_INTERNAL_BUILD_PER_MINUTE: num({ default: 1000 }),
  PRERENDER_INTERNAL_TOKEN: str({ default: '' }),

  // CORS (BACKEND_ARCHITECTURE.md §47)
  CORS_ALLOWED_ORIGINS: str({ default: 'http://localhost:5173' }),

  // Logging
  LOG_LEVEL: str({
    choices: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    default: 'info',
  }),

  // AI Platform (Phase 15) — every var below defaults to empty/safe, so
  // the app always boots without any of these set (matches this file's
  // established all-defaults pattern). Selecting a non-'local' provider
  // with no matching key is a runtime AiService error, never a boot
  // crash — see providers/providerRegistry.js.
  AI_DEFAULT_PROVIDER: str({ default: 'local' }),
  AI_CACHE_TTL_SECONDS: num({ default: 3600 }),
  AI_MAX_RETRIES: num({ default: 2 }),
  OPENAI_API_KEY: str({ default: '' }),
  OPENAI_MODEL: str({ default: 'gpt-4o-mini' }),
  ANTHROPIC_API_KEY: str({ default: '' }),
  ANTHROPIC_MODEL: str({ default: 'claude-sonnet-5' }),
  GEMINI_API_KEY: str({ default: '' }),
  GEMINI_MODEL: str({ default: 'gemini-2.0-flash' }),
  AZURE_OPENAI_API_KEY: str({ default: '' }),
  AZURE_OPENAI_ENDPOINT: str({ default: '' }),
  AZURE_OPENAI_DEPLOYMENT: str({ default: '' }),
  AZURE_OPENAI_API_VERSION: str({ default: '2024-06-01' }),
  OLLAMA_BASE_URL: str({ default: 'http://localhost:11434' }),
  OLLAMA_MODEL: str({ default: 'llama3.1' }),

  // Payment Infrastructure (Phase 16) — every var below defaults to
  // empty/safe, matching this file's established all-defaults pattern.
  // `local` (never touches real money) is the default and only enabled
  // provider until real credentials exist; selecting `stripe` without a
  // secret key is a runtime PaymentService error, never a boot crash —
  // see modules/payments/providers/paymentProviderRegistry.js.
  PAYMENT_DEFAULT_PROVIDER: str({ default: 'local' }),
  STRIPE_SECRET_KEY: str({ default: '' }),
  STRIPE_WEBHOOK_SECRET: str({ default: '' }),
  STRIPE_API_VERSION: str({ default: '2024-06-20' }),
});

/**
 * Frozen, validated configuration object — the single import point every
 * module uses for configuration. Never read `process.env` directly
 * outside this file (BACKEND_ARCHITECTURE.md §18).
 */
const config = Object.freeze({
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,

  database: Object.freeze({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    name: env.NODE_ENV === 'test' ? env.DATABASE_NAME_TEST : env.DATABASE_NAME,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
  }),

  redis: Object.freeze({
    url: env.REDIS_URL,
  }),

  jwt: Object.freeze({
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  }),

  booking: Object.freeze({
    holdDurationMinutes: env.RESERVATION_HOLD_DURATION_MINUTES,
    pendingVendorSlaHours: env.BOOKING_PENDING_VENDOR_SLA_HOURS,
  }),

  rateLimit: Object.freeze({
    authenticatedPerMinute: env.RATE_LIMIT_AUTHENTICATED_PER_MINUTE,
    publicPerMinute: env.RATE_LIMIT_PUBLIC_PER_MINUTE,
    sensitivePerMinute: env.RATE_LIMIT_SENSITIVE_PER_MINUTE,
    internalBuildPerMinute: env.RATE_LIMIT_INTERNAL_BUILD_PER_MINUTE,
  }),

  prerenderInternalToken: env.PRERENDER_INTERNAL_TOKEN,

  cors: Object.freeze({
    allowedOrigins: env.CORS_ALLOWED_ORIGINS.split(',').map((origin) =>
      origin.trim(),
    ),
  }),

  logging: Object.freeze({
    level: env.LOG_LEVEL,
  }),

  ai: Object.freeze({
    defaultProvider: env.AI_DEFAULT_PROVIDER,
    cacheTtlSeconds: env.AI_CACHE_TTL_SECONDS,
    maxRetries: env.AI_MAX_RETRIES,
    openai: Object.freeze({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    }),
    anthropic: Object.freeze({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
    }),
    gemini: Object.freeze({
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
    }),
    azureOpenai: Object.freeze({
      apiKey: env.AZURE_OPENAI_API_KEY,
      endpoint: env.AZURE_OPENAI_ENDPOINT,
      deployment: env.AZURE_OPENAI_DEPLOYMENT,
      apiVersion: env.AZURE_OPENAI_API_VERSION,
    }),
    ollama: Object.freeze({
      baseUrl: env.OLLAMA_BASE_URL,
      model: env.OLLAMA_MODEL,
    }),
  }),

  payments: Object.freeze({
    defaultProvider: env.PAYMENT_DEFAULT_PROVIDER,
    stripe: Object.freeze({
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      apiVersion: env.STRIPE_API_VERSION,
    }),
  }),
});

export default config;
