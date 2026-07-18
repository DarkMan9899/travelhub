/**
 * NOTE: this deliberately does NOT use ESLint's `extends: ['@travelhub/config/...']`
 * string form. ESLint 8's shareable-config naming convention silently
 * rewrites scoped package names in `extends` (e.g. `@travelhub/config`
 * is treated as shorthand for `@travelhub/eslint-config-config`), which
 * does not exist and fails with a misleading "couldn't find the config"
 * error. Requiring the file directly via plain Node module resolution
 * (already proven to work — see the module's own README) and spreading
 * it here sidesteps that naming convention entirely; the shared config's
 * OWN nested `extends` (airbnb-base, plugin:prettier/recommended) still
 * resolves normally because those follow ESLint's expected naming
 * convention already.
 */
const backendConfig = require('@travelhub/config/src/eslint-backend.cjs');

module.exports = {
  ...backendConfig,
  ignorePatterns: ['node_modules', 'dist', 'coverage'],
};
