/**
 * Shared ESLint configuration for apps/api.
 *
 * Implements BACKEND_ARCHITECTURE.md §10 (Linting) and §3 (Clean
 * Architecture Layers): one base config, extended — never overridden —
 * per app, plus the module/layer dependency-direction rules encoded as
 * `eslint-plugin-boundaries` element types so an architecture violation
 * is a failing lint rule, not a code-review judgment call.
 *
 * See BACKEND_ARCHITECTURE.md §2 for the folder structure this maps to.
 */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    jest: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  extends: ['airbnb-base', 'plugin:prettier/recommended'],
  plugins: ['import', 'boundaries'],
  settings: {
    'import/resolver': {
      node: { extensions: ['.js'] },
    },
    'boundaries/elements': [
      { type: 'core', pattern: 'src/core/*' },
      { type: 'infrastructure', pattern: 'src/infrastructure/*' },
      { type: 'modules', pattern: 'src/modules/*', capture: ['moduleName'] },
      { type: 'crosscutting', pattern: 'src/{middleware,guards,errors,validation,logging,monitoring,config,container,jobs}/*' },
      { type: 'app', pattern: 'src/{app,server}.js' },
    ],
  },
  rules: {
    // --- Clean Architecture dependency direction (BACKEND_ARCHITECTURE.md §3.1) ---
    'boundaries/element-types': [
      2,
      {
        default: 'disallow',
        rules: [
          // core (Domain) may depend on nothing but itself
          { from: 'core', allow: ['core'] },
          // infrastructure (adapters) may depend on core (implements its ports) and crosscutting
          { from: 'infrastructure', allow: ['core', 'infrastructure', 'crosscutting'] },
          // modules may depend on core, infrastructure (via DI), crosscutting, and other
          // modules' public surface — the plugin enforces folder-level boundaries;
          // "public surface only" (index.js) is additionally enforced by code review
          // per BACKEND_ARCHITECTURE.md §4.
          { from: 'modules', allow: ['core', 'infrastructure', 'crosscutting', 'modules'] },
          // crosscutting (middleware/guards/errors/validation/etc.) may depend on core only
          { from: 'crosscutting', allow: ['core', 'crosscutting'] },
          // the app composition root may depend on anything
          { from: 'app', allow: ['core', 'infrastructure', 'modules', 'crosscutting'] },
        ],
      },
    ],
    // --- General discipline (BACKEND_ARCHITECTURE.md §1, §47) ---
    'no-console': ['warn', { allow: ['warn', 'error'] }], // use the shared logger instead (Ch. 20)
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['**/*.test.js', '**/*.spec.js', 'tests/**'] },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.object.name='mysql'][callee.property.name=/query/] TemplateLiteral",
        message:
          'No string-concatenated/template-literal SQL — use parameterized queries only (BACKEND_ARCHITECTURE.md §47).',
      },
    ],
    'class-methods-use-this': 'off',
    'no-underscore-dangle': 'off',
    // This codebase is native ESM ("type": "module") — relative imports
    // REQUIRE an explicit .js extension for Node's own module resolution
    // to work at runtime; airbnb-base's default (no extensions, assuming
    // a bundler) is the opposite of correct here.
    'import/extensions': ['error', 'ignorePackages'],
    // BACKEND_ARCHITECTURE.md §24 deliberately groups the entire Exception
    // Hierarchy in one file (src/errors/AppError.js) for cohesion — the
    // base class plus its small, closed set of subclasses are meant to be
    // read together, not split across files.
    'max-classes-per-file': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/*.spec.js', 'tests/**/*.js'],
      rules: {
        'no-unused-expressions': 'off',
      },
    },
  ],
};
