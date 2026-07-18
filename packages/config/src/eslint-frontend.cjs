/**
 * Shared ESLint configuration for apps/web.
 *
 * Implements FRONTEND_ARCHITECTURE.md §39 (Coding Standards) — one base
 * config, no per-module override — and the folder-boundary contracts
 * from §3.1 as `eslint-plugin-boundaries` rules, plus the accessibility
 * floor from §30 via `eslint-plugin-jsx-a11y`.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  extends: [
    'airbnb',
    'airbnb/hooks',
    'plugin:jsx-a11y/strict',
    'plugin:prettier/recommended',
  ],
  plugins: ['react', 'react-hooks', 'jsx-a11y', 'import', 'boundaries'],
  settings: {
    react: { version: 'detect' },
    'import/resolver': {
      node: { extensions: ['.js', '.jsx'] },
    },
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/*' },
      { type: 'routes', pattern: 'src/routes/*' },
      { type: 'layouts', pattern: 'src/layouts/*' },
      { type: 'pages', pattern: 'src/pages/*' },
      { type: 'modules', pattern: 'src/modules/*', capture: ['moduleName'] },
      { type: 'components', pattern: 'src/components/*' },
      { type: 'ui', pattern: 'src/ui/*' },
      { type: 'hooks', pattern: 'src/hooks/*' },
      { type: 'api', pattern: 'src/api/*' },
      { type: 'services', pattern: 'src/services/*' },
      { type: 'contexts', pattern: 'src/{contexts,providers}/*' },
      { type: 'guards', pattern: 'src/guards/*' },
      { type: 'utils', pattern: 'src/{utils,constants}/*' },
    ],
  },
  rules: {
    // --- Module/layer dependency direction (FRONTEND_ARCHITECTURE.md §3.1) ---
    'boundaries/element-types': [
      2,
      {
        default: 'disallow',
        rules: [
          { from: 'app', allow: ['app', 'routes', 'providers', 'api'] },
          { from: 'routes', allow: ['routes', 'pages', 'layouts', 'guards'] },
          { from: 'layouts', allow: ['layouts', 'components', 'ui', 'contexts', 'hooks', 'utils'] },
          { from: 'pages', allow: ['pages', 'modules', 'layouts', 'hooks', 'utils'] },
          { from: 'modules', allow: ['modules', 'components', 'ui', 'hooks', 'api', 'services', 'utils', 'contexts'] },
          { from: 'components', allow: ['components', 'ui', 'hooks', 'utils'] },
          { from: 'ui', allow: ['ui', 'utils'] },
          { from: 'hooks', allow: ['hooks', 'utils', 'api'] },
          { from: 'api', allow: ['api', 'utils'] },
          { from: 'services', allow: ['services', 'api', 'utils'] },
          { from: 'contexts', allow: ['contexts', 'api', 'utils'] },
          { from: 'guards', allow: ['guards', 'contexts', 'utils'] },
          { from: 'utils', allow: ['utils'] },
        ],
      },
    ],
    // --- React / accessibility discipline ---
    'react/react-in-jsx-scope': 'off', // Vite's automatic JSX runtime
    'react/jsx-filename-extension': ['error', { extensions: ['.jsx'] }],
    'react/function-component-definition': [
      'error',
      { namedComponents: 'function-declaration' },
    ],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'jsx-a11y/label-has-associated-control': 'error',
    // --- No hardcoded user-facing strings in JSX text (FRONTEND_ARCHITECTURE.md §16.5) ---
    // Enforced as a warning at scaffold time; tightened to `error` once the
    // i18next `t()` wrapper is in universal use from Sprint 1 onward.
    'react/jsx-no-literals': [
      'warn',
      { noStrings: true, ignoreProps: true, allowedStrings: ['·', '—', '&nbsp;'] },
    ],
    'import/prefer-default-export': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      {
        devDependencies: [
          '**/*.test.jsx',
          '**/*.test.js',
          '**/*.spec.js',
          'tests/**',
          'vite.config.js',
          'playwright.config.js',
        ],
      },
    ],
    // --- ESM requires explicit extensions on relative imports (Vite's
    // native ESM resolution, unlike CommonJS/webpack) — airbnb's default
    // forbids them, which is backwards for this stack.
    'import/extensions': [
      'error',
      'ignorePackages',
      { js: 'always', jsx: 'always' },
    ],
    // --- The Axios request-interceptor pattern (src/api/client.js)
    // idiomatically mutates the config object's properties, not the
    // parameter binding itself — this is the documented, standard Axios
    // interceptor shape, not an anti-pattern.
    'no-param-reassign': ['error', { props: false }],
    // --- __dirname/__filename are the standard Node/ESM
    // fileURLToPath-derived convention (see vite.config.js), not a
    // "dangling underscore" naming smell.
    'no-underscore-dangle': ['error', { allow: ['__dirname', '__filename'] }],
  },
};
