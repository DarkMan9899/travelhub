/**
 * See apps/api/.eslintrc.cjs for why this uses require() + spread rather
 * than ESLint's `extends: ['@desavii/config/...']` string form.
 *
 * Required by relative path, not `@desavii/config/...` — this package IS
 * @desavii/config, so requiring itself by package name would be a
 * self-dependency (and would fail `import/no-extraneous-dependencies`,
 * since a package never lists itself in its own `package.json`).
 *
 * Uses the backend config (CommonJS, Node-style) rather than the
 * frontend one — this package has no JSX. Its `boundaries/element-types`
 * rule patterns (src/core/*, src/infrastructure/*, ...) simply match
 * nothing in this package's flat src/ layout, so they are inert here,
 * not violated.
 */
const backendConfig = require('./src/eslint-backend.cjs');

module.exports = {
  ...backendConfig,
  ignorePatterns: ['node_modules', 'dist', 'coverage'],
};
