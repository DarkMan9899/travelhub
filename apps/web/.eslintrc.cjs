/**
 * See apps/api/.eslintrc.cjs for why this uses require() + spread rather
 * than ESLint's `extends: ['@travelhub/config/...']` string form (ESLint
 * 8's scoped-package shareable-config naming convention would otherwise
 * misinterpret the package name).
 */
const frontendConfig = require('@travelhub/config/src/eslint-frontend.cjs');

module.exports = {
  ...frontendConfig,
  ignorePatterns: ['node_modules', 'dist', 'coverage', 'playwright-report'],
};
