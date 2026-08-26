/**
 * @desavii/config public entry point.
 * Re-exports the shared ESLint configs (one per app environment, each
 * encoding that app's Clean-Architecture / module-boundary rules as
 * lint-enforced element-type rules) and the shared Prettier preset.
 * Consumed by apps/web/.eslintrc.cjs and apps/api/.eslintrc.cjs.
 */
const eslintBackend = require('./eslint-backend.cjs');
const eslintFrontend = require('./eslint-frontend.cjs');
const prettierPreset = require('./prettier-preset.cjs');

module.exports = {
  eslintBackend,
  eslintFrontend,
  prettierPreset,
};
