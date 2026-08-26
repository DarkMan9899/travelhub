/**
 * See apps/api/.eslintrc.cjs for why this uses require() + spread rather
 * than ESLint's `extends: ['@desavii/config/...']` string form.
 */
const frontendConfig = require('@desavii/config/src/eslint-frontend.cjs');

module.exports = {
  ...frontendConfig,
  ignorePatterns: ['node_modules', 'dist', 'coverage'],
};
