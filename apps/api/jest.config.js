/**
 * Jest configuration.
 *
 * Implements BACKEND_ARCHITECTURE.md §54 (Testing Strategy): three
 * distinct projects — unit (no infrastructure, milliseconds), integration
 * (real MySQL/Redis via Docker, run in CI), and contract (validates live
 * responses against the API_SPECIFICATION.md OpenAPI bundle, added once
 * that bundle exists). `npm test` runs only `unit` by default so the
 * fast local inner loop never requires Docker services to be running.
 *
 * NOTE on --forceExit (see package.json's test:integration/test:contract
 * scripts): only those two infrastructure-touching suites pass
 * --forceExit, never `test`/`test:unit`. This is a deliberate, narrow
 * exception — ioredis's internal reconnection scheduling can leave a
 * short-lived (bounded, self-resolving) timer handle open when Redis is
 * unreachable during test teardown, which is otherwise harmless but
 * would make Jest wait up to its own idle-detection window before
 * exiting. If the unit suite ever needed --forceExit, that would indicate
 * a real bug (unit tests must never touch real infrastructure,
 * BACKEND_ARCHITECTURE.md §55) — so it is intentionally absent there.
 */

export default {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      transform: {},
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      transform: {},
      // Sprint 5: ensures the isolated DATABASE_NAME_TEST database exists
      // on the MySQL server before any integration test connects to it —
      // see tests/integration/globalSetup.js.
      globalSetup: '<rootDir>/tests/integration/globalSetup.js',
    },
    {
      displayName: 'contract',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/contract/**/*.test.js'],
      transform: {},
    },
  ],
};
