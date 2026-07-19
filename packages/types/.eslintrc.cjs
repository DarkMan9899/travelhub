/**
 * See apps/api/.eslintrc.cjs for why this uses require() + spread rather
 * than ESLint's `extends: ['@travelhub/config/...']` string form.
 *
 * Uses the backend config (CommonJS, Node-style) rather than the
 * frontend one — this package has no JSX and is required via plain
 * `require()` (see src/index.js), matching apps/api's module style more
 * closely than apps/web's. Its `boundaries/element-types` rule patterns
 * (src/core/*, src/infrastructure/*, ...) simply match nothing in this
 * package's flat src/ layout, so they are inert here, not violated.
 */
const backendConfig = require('@travelhub/config/src/eslint-backend.cjs');

module.exports = {
  ...backendConfig,
  ignorePatterns: ['node_modules', 'dist', 'coverage'],
};
